use crate::{fdt, Cpu, RAM_BASE};
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
pub struct Engine {
    cpu: Cpu,
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
        })
    }
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
    pub fn snapshot(&self) -> Result<Vec<u8>, JsValue> {
        self.cpu.snapshot().map_err(|e| JsValue::from_str(&e))
    }
    pub fn restore(&mut self, data: &[u8]) -> Result<(), JsValue> {
        self.cpu.restore(data).map_err(|e| JsValue::from_str(&e))
    }
    // Trusted conformance fixtures only; this is the existing test ELF loader.
    pub fn test_elf(&mut self, bytes: &[u8]) -> Vec<u64> {
        let symbols = crate::elf::load(&mut self.cpu, bytes);
        ["tohost", "begin_signature", "end_signature"].iter().map(|s| symbols.get(*s).copied().unwrap_or(0)).collect()
    }
    pub fn test_read(&self, address: u64) -> u64 {
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
    pub fn jit_clear(&mut self) { self.cpu.memory.metrics.jit_cache_clears += 1; self.cpu.jit.entries.clear(); self.cpu.jit.chain.clear(); self.cpu.jit.ready.clear(); self.cpu.jit.code.clear(); }
    // Called only at a host quiescent boundary, before recycling table slots.
    pub fn jit_usage(&self, ids: &[u32]) -> f64 {
        ids.iter().map(|id| self.cpu.jit.last_used.get(*id as usize).copied().unwrap_or(0)).max().unwrap_or(0) as f64
    }
    pub fn jit_evict(&mut self, ids: &[u32]) {
        let ids: std::collections::HashSet<u32> = ids.iter().copied().collect();
        self.cpu.memory.metrics.jit_cache_evictions += ids.len() as u64;
        self.cpu.jit.ready.retain(|id, _| !ids.contains(id));
        self.cpu.jit.code.retain(|_, (id, _)| !ids.contains(id));
        for entry in &mut self.cpu.jit.chain {
            if ids.contains(&entry.id) { entry.slot = 0; }
        }
        for entry in &mut self.cpu.jit.entries {
            if entry.as_ref().is_some_and(|e| ids.contains(&e.id)) { *entry = None; }
        }
    }
    pub fn jit_install(&mut self, id: u32, slot: u32, count: u32) { self.cpu.jit.ready.insert(id, (slot, count)); }
    pub fn jit_table(&self) -> JsValue { wasm_bindgen::function_table() }
    pub fn jit_threshold(&mut self, threshold: u32) { self.cpu.jit.threshold = threshold; self.cpu.jit.at_entry = true; }
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
        Ok(())
    }
    pub fn take_disk(&mut self) -> Vec<u8> { std::mem::take(&mut self.cpu.memory.devices.disk) }
    pub fn lazy_disk(&mut self, bytes: f64) { self.cpu.memory.devices.disk_bytes = bytes as u64; }
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
        self.cpu.run(instructions);
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
    pub fn register(&self, index: u32) -> u64 {
        self.cpu.x.get(index as usize).copied().unwrap_or(0)
    }
}
