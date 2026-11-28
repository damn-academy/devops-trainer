use crate::{fdt, Cpu, RAM_BASE};
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64SnapshotPage)]
    pub(crate) fn snapshot_page(index: u32, page: &mut [u8]);
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64SharedAccess)]
    pub(crate) fn shared_access(op: u32, offset: u32, size: u32, value: u64) -> u64;
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64SharedImage)]
    pub(crate) fn shared_image(offset: u32, bytes: &[u8]);
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64SharedDmaWrite)]
    pub(crate) fn shared_dma_write(offset: u32, bytes: &[u8]);
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64SharedDmaRead)]
    pub(crate) fn shared_dma_read(offset: u32, bytes: &mut [u8]);
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64SharedMmio)]
    pub(crate) fn shared_mmio(write: bool, address: u64, size: u32, value: u64) -> u64;
}
// Direct shared-bus imports, provided by smp.ts sharedAccessModule() as wasm
// functions: no JS frame, no BigInt. Offsets are guest-physical RAM offsets,
// bounded and aligned by the callers; stores follow the shared write protocol.
#[link(wasm_import_module = "rv64shared")]
extern "C" {
    #[link_name = "load"] fn bus_load(offset: u32, size: u32) -> u64;
    #[link_name = "store"] fn bus_store(offset: u32, size: u32, value: u64);
    #[link_name = "fetch"] fn bus_fetch(offset: u32) -> u32;
    #[link_name = "generation"] fn bus_generation(page: u32) -> u32;
    #[link_name = "cas"] fn bus_cas(offset: u32, expected: u64, value: u64) -> u64;
    #[link_name = "mark"] fn bus_mark(page: u32);
}
#[inline] pub(crate) fn shared_load(offset: u32, size: u32) -> u64 { unsafe { bus_load(offset, size) } }
#[inline] pub(crate) fn shared_store(offset: u32, size: u32, value: u64) { unsafe { bus_store(offset, size, value) } }
#[inline] pub(crate) fn shared_fetch(offset: u32) -> u32 { unsafe { bus_fetch(offset) } }
#[inline] pub(crate) fn shared_generation(page: u32) -> u32 { unsafe { bus_generation(page) } }
#[inline] pub(crate) fn shared_mark_code(page: u32) { unsafe { bus_mark(page) } }
#[inline] pub(crate) fn shared_cas(offset: u32, expected: u64, value: u64) -> u64 { unsafe { bus_cas(offset, expected, value) } }
#[wasm_bindgen]
pub struct Engine {
    cpu: Cpu,
    profile_interval: u32,
    profile_left: u32,
    profile_samples: Vec<[u64; 44]>,
    profile_dropped: u64,
    profile_comm_offset: u32,
}
#[wasm_bindgen]
impl Engine {
    #[wasm_bindgen(constructor)]
    pub fn new(memory_mb: u32) -> Result<Engine, JsValue> {
        if !(32..=1024).contains(&memory_mb) {
            return Err(JsValue::from_str("memory must be 32..1024 MiB"));
        }
        Ok(Self {
            cpu: Cpu::new(memory_mb as usize * 1024 * 1024),
            profile_interval: 0,
            profile_left: 0,
            profile_samples: Vec::new(),
            profile_dropped: 0,
            profile_comm_offset: 0,
        })
    }
    /// JIT frame ABI includes inline load/store counters (24 u64 fields).
    pub fn smp_jit_abi(&self) -> u32 { 9 }

    /// Experimental hart. RAM belongs to the host shared bus.
    pub fn smp_configure(&mut self, hart: u32, bytes: u32) -> Result<(), JsValue> {
        if hart >= 4 || bytes < 32 * 1024 * 1024 || bytes > 1024 * 1024 * 1024 { return Err(JsValue::from_str("invalid SMP geometry")); }
        self.cpu = Cpu::new(0);
        self.cpu.memory.shared_bytes = bytes as usize;
        self.cpu.memory.jit_pages = vec![0; bytes as usize / 4096];
        self.cpu.csr[0xf14] = hart as u64;
        Ok(())
    }
    pub fn smp_boot(&mut self, kernel: &[u8], initrd: &[u8], cmdline: &str, harts: u32) -> Result<(), JsValue> {
        if !matches!(harts, 2 | 4) || self.cpu.memory.shared_bytes == 0 { return Err(JsValue::from_str("invalid SMP boot")); }
        let rd = RAM_BASE + 0x8000000; let dtb = RAM_BASE + 0x4000000;
        let tree = fdt::build_harts(self.cpu.memory.shared_bytes as u64, rd, initrd.len() as u64, cmdline, harts);
        for (a, data) in [(RAM_BASE + 0x200000, kernel), (rd, initrd), (dtb, tree.as_slice())] {
            self.cpu.memory.load_image(a, data).map_err(|e| JsValue::from_str(&format!("image load: {e:?}")))?;
        }
        self.cpu.boot_supervisor(RAM_BASE + 0x200000, dtb); Ok(())
    }
    pub fn smp_start(&mut self, entry: u64, opaque: u64) {
        self.cpu.x = [0; 32]; self.cpu.csr[0x180] = 0;
        self.cpu.csr[0x304] = 0; self.cpu.csr[0x344] = 0;
        self.cpu.waiting = false; self.cpu.stopped = false;
        self.cpu.boot_supervisor(entry, opaque);
        self.cpu.csr[0x300] &= !(1 << 1);
        self.cpu.memory.flush();
    }
    pub fn smp_request(&mut self) -> Vec<u64> { self.cpu.smp_request.take().map_or_else(Vec::new, |v| v.to_vec()) }
    pub fn smp_reply(&mut self, error: i64, value: u64) { self.cpu.x[10] = error as u64; self.cpu.x[11] = value; }
    pub fn smp_ipi(&mut self) { self.cpu.memory.metrics.remote_ipis += 1; self.cpu.csr[0x344] |= 2; }
    pub fn smp_fence(&mut self) {
        self.cpu.memory.metrics.remote_fence_i += 1;
        self.cpu.memory.metrics.sbi_fences += 1;
        // Like local FENCE.I, retain physical code. SharedHartMemory publishes
        // every store's page generation before the mailbox request, and the
        // host ACKs only after this call returns. jit_block reloads that shared
        // generation on every SMP entry; the shared chain dispatcher also checks
        // the live shared generation. Thus stale code cannot run after ACK.
        self.cpu.memory.flush();
    }
    /// Remote SFENCE.VMA (including ASID/range requests) may over-flush the
    /// target TLB, but must retain physical-byte JIT code. Every JIT entry
    /// revalidates translation/permissions with the current satp, including ASID.
    pub fn smp_sfence(&mut self) {
        self.cpu.memory.metrics.remote_sfence_vma += 1;
        self.cpu.memory.metrics.sbi_fences += 1;
        self.cpu.memory.flush();
    }
    pub fn smp_run(&mut self, count: u32, ticks: f64, external: u64) -> u32 {
        self.cpu.time(ticks as u64);
        self.cpu.csr[0x344] = (self.cpu.csr[0x344] & !((1 << 11) | (1 << 9))) | external;
        self.profiled_run_once(count);
        // Bits 0-1: 0 running, 1 waiting (WFI), 2 stopped. Bit 2: an SBI request
        // is queued for smp_request(). Bit 3: console bytes are queued for output().
        (if self.cpu.stopped { 2 } else if self.cpu.waiting { 1 } else { 0 })
            | (self.cpu.smp_request.is_some() as u32) << 2
            | ((!self.cpu.console.is_empty() || !self.cpu.memory.devices.console.is_empty()) as u32) << 3
    }
    /// Device-engine work queued for the host: bit 0 transmit frames, bit 1
    /// console bytes, bit 2 missing disk chunks.
    pub fn smp_device_pending(&self) -> u32 {
        let d = &self.cpu.memory.devices;
        (!d.net_tx.is_empty() as u32) | (!d.console.is_empty() as u32) << 1 | (!d.disk_missing.is_empty() as u32) << 2
    }
    pub fn smp_device_read(&mut self, address: u64) -> u64 { self.cpu.memory.devices.read(address).unwrap_or(0) }
    pub fn smp_device_write(&mut self, address: u64, value: u32) { self.cpu.memory.devices.write(address, value); }
    pub fn smp_devices(&mut self) { self.cpu.service_devices(); }
    pub fn smp_interrupts(&self, hart: u32) -> u64 { self.cpu.memory.devices.hart_interrupts(hart as usize) }
    /// Quiesced all-hart barrier piece: this hart's (or the device engine's) state, no RAM.
    pub fn smp_snapshot(&mut self) -> Result<Vec<u8>, JsValue> { self.cpu.smp_snapshot().map_err(|e| JsValue::from_str(&e)) }
    pub fn smp_restore(&mut self, data: &[u8]) -> Result<(), JsValue> { self.cpu.smp_restore(data).map_err(|e| JsValue::from_str(&e)) }
    pub fn boot(&mut self, kernel: &[u8], initrd: &[u8], cmdline: &str) -> Result<(), JsValue> {
        let entry = RAM_BASE + 0x200000;
        let rd = RAM_BASE + 0x8000000;
        let dtb = RAM_BASE + 0x4000000;
        let tree = fdt::build(
            self.cpu.memory.ram.len() as u64,
            rd,
            initrd.len() as u64,
            cmdline,
        );
        for (a, data) in [(entry, kernel), (rd, initrd), (dtb, tree.as_slice())] {
            self.cpu
                .memory
                .load_image(a, data)
                .map_err(|e| JsValue::from_str(&format!("image load: {e:?}")))?;
        }
        self.cpu.boot_supervisor(entry, dtb);
        Ok(())
    }
    pub fn load_program(&mut self, program: &[u8]) -> Result<(), JsValue> {
        self.cpu
            .memory
            .load_image(RAM_BASE, program)
            .map_err(|e| JsValue::from_str(&format!("program: {e:?}")))?;
        Ok(())
    }
    pub fn snapshot(&mut self) -> Result<Vec<u8>, JsValue> {
        self.cpu.snapshot().map_err(|e| JsValue::from_str(&e))
    }
    pub fn restore(&mut self, data: &[u8]) -> Result<(), JsValue> {
        self.cpu.restore(data).map_err(|e| JsValue::from_str(&e))
    }
    pub fn snapshot_metadata(&mut self) -> Result<Vec<u8>, JsValue> {
        self.cpu.snapshot_metadata().map_err(|e| JsValue::from_str(&e))
    }
    pub fn snapshot_ram(&mut self, index: u32) -> Result<Vec<u8>, JsValue> {
        let start = index as usize * 262144;
        if start >= self.cpu.memory.ram.len() { return Err(JsValue::from_str("RAM chunk out of range")); }
        let size = (self.cpu.memory.ram.len() - start).min(262144);
        self.cpu.memory.ensure_ram(start, size);
        Ok(self.cpu.memory.ram[start..start+size].to_vec())
    }
    pub fn restore_paged(&mut self, metadata: &[u8], present: &[u8]) -> Result<(), JsValue> {
        self.cpu.restore_paged(metadata, present).map_err(|e| JsValue::from_str(&e))
    }
    // Trusted conformance fixtures only; this is the existing test ELF loader.
    pub fn test_elf(&mut self, bytes: &[u8]) -> Vec<u64> {
        let symbols = crate::elf::load(&mut self.cpu, bytes);
        ["tohost", "begin_signature", "end_signature"].iter().map(|s| symbols.get(*s).copied().unwrap_or(0)).collect()
    }
    pub fn test_hart(&mut self, hart: u32) { self.cpu.csr[0xf14] = hart as u64; }
    // Per-instruction trace capture for real-boot replay evidence.
    pub fn test_trace(&mut self, on: bool) { self.cpu.trace_enabled = on; }
    /// [kind, pcLo, pcHi, x0Lo, x0Hi, x1Lo, x1Hi]; kind 0 = instruction (x0=raw), 1 = trap (x0=cause, x1=value).
    pub fn test_last_trace(&self) -> Vec<u64> {
        match &self.cpu.last_trace {
            Some(crate::cpu::TraceEvent::Instruction { pc, raw }) => vec![0, *pc & 0xffffffff, *pc >> 32, *raw as u64, 0, 0, 0],
            Some(crate::cpu::TraceEvent::Trap { pc, trap, target }) => vec![1, *pc & 0xffffffff, *pc >> 32, trap.cause, 0, *target & 0xffffffff, *target >> 32],
            None => vec![],
        }
    }
    pub fn test_read(&mut self, address: u64) -> u64 {
        self.cpu.memory.physical_read(address, 8, crate::Access::Read).unwrap()
    }
    pub fn test_single_step(&mut self) { self.jit_clear(); self.cpu.jit.single_step = true; }
    pub fn test_block(&mut self) -> u32 {
        let n = self.cpu.jit_block(if self.cpu.jit.single_step { 1 } else { 64 });
        if n == u32::MAX { return 0; }
        if n != 0 { return n; }
        self.cpu.run(1); 1
    }
    pub fn test_steps(&mut self, n: u32) { self.cpu.run(n); }
    pub fn test_time(&mut self, ticks: u64) { self.cpu.time(ticks); self.cpu.service_devices(); }
    pub fn test_equal(&self, other: &Engine, ram: bool) -> bool {
        self.cpu.pc == other.cpu.pc && self.cpu.x == other.cpu.x && self.cpu.f == other.cpu.f &&
        self.cpu.mode == other.cpu.mode && self.cpu.csr == other.cpu.csr &&
        self.cpu.retired == other.cpu.retired && self.cpu.cycles == other.cpu.cycles &&
        self.cpu.waiting == other.cpu.waiting && self.cpu.stopped == other.cpu.stopped &&
        (!ram || self.cpu.memory.ram == other.cpu.memory.ram)
    }
    pub fn test_attempted(&self) -> f64 { self.cpu.jit.attempted as f64 }
    pub fn test_cycles(&self) -> f64 { self.cpu.cycles as f64 }
    pub fn jit_retired(&self) -> f64 { self.cpu.jit.retired as f64 }
    pub fn metrics(&self) -> String { self.cpu.memory.metrics.json() }
    pub fn jit_clear(&mut self) { self.cpu.memory.metrics.jit_cache_clears += 1; self.cpu.jit.entries.clear(); self.cpu.jit.chain.clear(); self.cpu.jit.ready.clear(); self.cpu.jit.code.clear(); self.cpu.jit.owners.clear(); }
    // Called only at a host quiescent boundary, before recycling table slots.
    pub fn jit_usage(&self, ids: &[u32]) -> f64 {
        ids.iter().map(|id| self.cpu.jit.last_used.get(*id as usize).copied().unwrap_or(0)).max().unwrap_or(0) as f64
    }
    pub fn jit_evict(&mut self, ids: &[u32]) {
        let ids: crate::jit::FastSet<u32> = ids.iter().copied().collect();
        self.cpu.memory.metrics.jit_cache_evictions += ids.len() as u64;
        let jit = &mut self.cpu.jit;
        for id in &ids {
            jit.ready.remove(id);
            let Some((key, index)) = jit.owners.remove(id) else { continue };
            if jit.code.get(&key).is_some_and(|(owner, _)| owner == id) { jit.code.remove(&key); }
            if let Some(entry) = jit.chain.get_mut(index as usize) { if entry.id == *id { entry.slot = 0; } }
            if let Some(entry) = jit.entries.get_mut(index as usize) { if entry.as_ref().is_some_and(|e| e.id == *id) { *entry = None; } }
        }
    }
    pub fn jit_share_abi(&self) -> u32 { 12 }
    pub fn jit_install(&mut self, id: u32, slot: u32, count: u32) { self.cpu.jit.ready.insert(id, (slot, count)); }
    pub fn jit_table(&self) -> JsValue { wasm_bindgen::function_table() }
    pub fn jit_threshold(&mut self, threshold: u32) { self.cpu.jit.threshold = threshold; self.cpu.jit.at_entry = true; }
    pub fn guest_ticks(&self) -> f64 { self.cpu.memory.time as f64 }
    pub fn ticks(&self) -> f64 { self.cpu.memory.host_ticks as f64 }
    pub fn input(&mut self, data: &[u8]) {
        self.cpu.input.extend(data);
        self.cpu.memory.devices.input.extend(data);
    }
    pub fn entropy(&mut self, data: &[u8]) {
        self.cpu.memory.devices.entropy.extend(data);
    }
    pub fn set_mac(&mut self, mac: &[u8]) -> Result<(), JsValue> {
        if mac.len() != 6 || mac[0] & 1 != 0 { return Err(JsValue::from_str("invalid unicast MAC")); }
        self.cpu.memory.devices.mac.copy_from_slice(mac); Ok(())
    }
    pub fn net_receive(&mut self, data: &[u8]) {
        self.cpu.memory.devices.net_rx.push_back(data.to_vec());
    }
    pub fn net_take(&mut self) -> Vec<u8> {
        self.cpu
            .memory
            .devices
            .net_tx
            .pop_front()
            .unwrap_or_default()
    }
    pub fn stimecmp_writes(&self) -> f64 { self.cpu.stimecmp_writes as f64 }
    pub fn disk_state(&self) -> Result<Vec<u8>, JsValue> {
        let d = &self.cpu.memory.devices;
        bincode::serialize(&(&d.disk, d.disk_bytes, &d.disk_chunks)).map_err(|e| JsValue::from_str(&e.to_string()))
    }
    pub fn restore_disk(&mut self, state: &[u8]) -> Result<(), JsValue> {
        let (disk, bytes, chunks) = bincode::deserialize(state).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let d = &mut self.cpu.memory.devices;
        d.disk = disk; d.disk_bytes = bytes; d.disk_chunks = chunks;
        d.disk_dirty = d.disk_chunks.keys().copied().collect();
        Ok(())
    }
    pub fn take_disk(&mut self) -> Vec<u8> { std::mem::take(&mut self.cpu.memory.devices.disk) }
    pub fn lazy_disk(&mut self, bytes: f64) { self.cpu.memory.devices.disk_bytes = bytes as u64; }
    pub fn disk_trim_clean(&mut self) {
        let d = &mut self.cpu.memory.devices;
        d.disk_chunks.retain(|index, _| d.disk_dirty.contains(index));
    }
    pub fn disk_cached(&self) -> Vec<u32> { self.cpu.memory.devices.disk_chunks.keys().map(|i| *i as u32).collect() }
    pub fn disk_prune(&mut self, index: u32, base: &[u8]) -> bool {
        let d = &mut self.cpu.memory.devices;
        if d.disk_chunks.get(&(index as u64)).is_some_and(|bytes| bytes == base) {
            d.disk_dirty.remove(&(index as u64)); true
        } else { false }
    }
    pub fn disk_missing(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.cpu.memory.devices.disk_missing).into_iter().map(|i| i as u32).collect()
    }
    pub fn disk_chunk(&mut self, index: u32, bytes: &[u8]) -> Result<(), JsValue> {
        self.cpu.memory.devices.disk_chunk(index as u64, bytes.to_vec()).map_err(|e| JsValue::from_str(&e))
    }
    pub fn disk(&mut self, data: &[u8]) {
        self.cpu.memory.devices.disk = data.to_vec();
    }
    pub fn run(&mut self, instructions: u32, time_ticks: f64) -> u32 {
        self.cpu.time(time_ticks as u64);
        self.cpu.service_devices();
        self.profiled_run(instructions);
        if self.cpu.reset_requested {
            3
        } else if self.cpu.stopped {
            2
        } else if self.cpu.waiting {
            1
        } else {
            0
        }
    }
    fn profiled_run(&mut self, instructions: u32) {
        if self.profile_interval == 0 {
            self.cpu.run(instructions);
            return;
        }
        let mut left = instructions;
        while left > 0 {
            let budget = left.min(self.profile_left);
            let before = self.cpu.jit.attempted;
            self.cpu.run(budget);
            let used = (self.cpu.jit.attempted - before) as u32;
            left -= used;
            self.profile_left -= used;
            if self.profile_left == 0 { self.profile_sample(); }
            if used == 0 || self.cpu.waiting || self.cpu.stopped { break; }
        }
    }
    /// Single-shot profiling for SMP: one cpu.run per call, exactly matching the
    /// scheduling granularity the SMP workers had before profiling existed. The
    /// multi-chunk loop in profiled_run lets a hart burn its remaining budget
    /// without yielding to the event loop, which perturbs cross-hart timing.
    fn profiled_run_once(&mut self, instructions: u32) {
        if self.profile_interval == 0 {
            self.cpu.run(instructions);
            return;
        }
        let before = self.cpu.jit.attempted;
        self.cpu.run(instructions);
        let used = (self.cpu.jit.attempted - before) as u32;
        if used >= self.profile_left { self.profile_sample(); }
        else { self.profile_left -= used; }
    }
    fn profile_sample(&mut self) {
        // Instruction-attempt samples, including traps, not wall time.
        // Hex serialization below preserves full Sv39/64-bit addresses.
        let task = if self.cpu.mode == crate::Mode::U { self.cpu.csr[0x140] } else { self.cpu.x[4] };
        let comm = if self.profile_comm_offset != 0 {
            task.checked_add(self.profile_comm_offset as u64)
                .and_then(|a| crate::profile::task_comm(&self.cpu.memory, self.cpu.csr[0x180], a))
        } else { None }.unwrap_or([0; 2]);
        let mut row = [0; 44];
        row[..9].copy_from_slice(&[self.cpu.pc, self.cpu.csr[0x180], self.cpu.mode as u64,
            self.cpu.x[4], self.cpu.csr[0x140], self.cpu.memory.time,
            self.cpu.jit.attempted, comm[0], comm[1]]);
        row[9] = self.cpu.x[1]; row[10] = self.cpu.x[2];
        if self.cpu.mode == crate::Mode::U {
            for j in 0..32 {
                if let Some(word) = self.cpu.x[2].checked_add(j * 8).and_then(|a| crate::profile::stack_word(&self.cpu.memory, self.cpu.csr[0x180], a)) {
                    row[11] |= 1 << j; row[12 + j as usize] = word;
                }
            }
        }
        if self.profile_samples.len() < 65536 { self.profile_samples.push(row); }
        else { self.profile_dropped += 1; }
        self.profile_left = self.profile_interval;
    }
    pub fn output(&mut self) -> Vec<u8> {
        let mut out = std::mem::take(&mut self.cpu.console);
        out.append(&mut self.cpu.memory.devices.console);
        out
    }
    pub fn deadline_ms(&self) -> f64 {
        let deadline = self.cpu.csr[0x14d].min(self.cpu.memory.mtimecmp);
        deadline.saturating_sub(self.cpu.memory.time) as f64 / 10000.0
    }
    pub fn retired(&self) -> f64 {
        self.cpu.retired as f64
    }
    pub fn pc(&self) -> u64 {
        self.cpu.pc
    }
    pub fn profile_configure(&mut self, interval: u32) {
        self.profile_interval = interval;
        self.profile_left = interval;
        self.profile_samples.clear();
        self.profile_dropped = 0;
    }
    pub fn profile_task_comm(&mut self, offset: u32) { self.profile_comm_offset = offset; }
    pub fn profile_drain(&mut self) -> String {
        use std::fmt::Write;
        let mut out = format!("{{\"interval\":{},\"dropped\":{},\"rows\":[", self.profile_interval, self.profile_dropped);
        self.profile_dropped = 0;
        for (i, row) in self.profile_samples.drain(..).enumerate() {
            if i != 0 { out.push(','); }
            write!(out, "[\"{:x}\",\"{:x}\",{},\"{:x}\",\"{:x}\",{},{},\"{:x}\",\"{:x}\"", row[0],row[1],row[2],row[3],row[4],row[5],row[6],row[7],row[8]).unwrap();
            for word in &row[9..] { write!(out, ",\"{word:x}\"").unwrap(); }
            out.push(']');
        }
        out.push_str("]}"); out
    }
    pub fn register(&self, index: u32) -> u64 {
        self.cpu.x.get(index as usize).copied().unwrap_or(0)
    }
}
