//! Browser JIT bridge with precise helpers for faulting slow paths.
//! Unsupported instructions retain the precise interpreter path.
use crate::{Access, Cpu};
use std::collections::{HashMap, HashSet};
use std::hash::{BuildHasherDefault, Hasher};
/// Multiply-rotate hash for small integer keys (block ids, physical/virtual
/// PCs). The default SipHash showed up in block dispatch and eviction profiles;
/// these keys are produced by the emulator, not by an adversary.
#[derive(Default, Clone, Copy)]
pub struct FastHasher(u64);
impl FastHasher {
    #[inline] fn add(&mut self, v: u64) { self.0 = (self.0.rotate_left(5) ^ v).wrapping_mul(0x517c_c1b7_2722_0a95); }
}
impl Hasher for FastHasher {
    #[inline] fn finish(&self) -> u64 { self.0 }
    #[inline] fn write(&mut self, bytes: &[u8]) { for b in bytes { self.add(*b as u64); } }
    #[inline] fn write_u32(&mut self, v: u32) { self.add(v as u64); }
    #[inline] fn write_u64(&mut self, v: u64) { self.add(v); }
    #[inline] fn write_usize(&mut self, v: usize) { self.add(v as u64); }
}
pub type FastMap<K, V> = HashMap<K, V, BuildHasherDefault<FastHasher>>;
pub type FastSet<K> = HashSet<K, BuildHasherDefault<FastHasher>>;
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = globalThis, js_name = rv64Compile)]
    fn compile(id: u32, pc: u64, words: &[u32], raw: &[u32], pa: u64, generation: u64);
}
#[derive(Default)]
pub struct Jit {
    pub threshold: u32,
    pub retired: u64,
    pub attempted: u64,
    pub last_used: Vec<u64>,
    pub chain: Vec<ChainEntry>,
    pub single_step: bool,
    pub at_entry: bool,
    serial: u32,
    pub code: FastMap<(u64,u64,u64), (u32,usize)>,
    pub ready: FastMap<u32, (u32, u32)>,
    /// Per block id: its code key and its entry/chain table index (one key
    /// always hashes to one index), so eviction never scans the tables.
    pub owners: FastMap<u32, ((u64,u64,u64), u32)>,
    pub entries: Vec<Option<Entry>>,
}
// Stable ABI for guarded generated-wasm tail-chain lookup. Slot zero is invalid.
#[repr(C)]
#[derive(Clone, Copy, Default)]
pub(crate) struct ChainEntry {
    pc: u64, pa: u64, generation: u64,
    pub(crate) slot: u32, count: u32, pub(crate) id: u32, reserved: u32,
}
const _: () = {
    assert!(std::mem::size_of::<ChainEntry>() == 40);
    assert!(std::mem::offset_of!(ChainEntry, slot) == 24);
    assert!(std::mem::offset_of!(ChainEntry, count) == 28);
    assert!(std::mem::offset_of!(ChainEntry, id) == 32);
};
#[derive(Clone, Copy)]
pub(crate) struct Entry { key: (u64,u64,u64), hits: u32, pub(crate) id: u32, bytes: usize, compiled: Option<(u32,u32)> }
// Keep this conservative: reserved encodings must reach the interpreter.
fn supported(i: u32) -> bool {
    let f = (i >> 12) & 7; let top = i >> 25;
    match i & 127 {
        0x2f => matches!(f,2|3),
        0x07 | 0x27 => matches!(f,2|3),
        0x43 | 0x47 | 0x4b | 0x4f | 0x53 => true,
        0x03 => f < 7,
        0x23 => f < 4,
        0x37 | 0x17 | 0x6f => true,
        0x67 => f == 0,
        0x63 => matches!(f, 0|1|4|5|6|7),
        0x13 => matches!(f, 0|2|3|4|6|7) || f == 1 && i >> 26 == 0 || f == 5 && matches!(i >> 26, 0|16),
        0x1b => f == 0 || f == 1 && top == 0 || f == 5 && matches!(top, 0|32),
        0x33 => top == 0 || top == 32 && matches!(f,0|5) || top == 1,
        0x3b => top == 0 && matches!(f,0|1|5) || top == 32 && matches!(f,0|5) || top == 1 && matches!(f,0|4|5|6|7),
        _ => false,
    }
}
#[inline]
pub(crate) fn ends_block(i: u32) -> bool {
    matches!(i & 127, 0x63|0x67|0x6f|0x73|0x0f|0x2f|0x07|0x27|0x43|0x47|0x4b|0x4f|0x53) || !supported(i)
}
impl Cpu {
    pub(crate) fn jit_block(&mut self, budget: u32) -> u32 {
        let cpu_ptr = self as *mut Cpu as u64;
        if self.jit.threshold == 0 || self.waiting || self.stopped || self.pc & 1 != 0 { return 0; }
        // Pending interrupts must be taken by step(), with its normal cycle accounting.
        let pending = self.csr[0x344] & self.csr[0x304] & 0xaaa;
        let machine = if self.mode != crate::Mode::M || self.csr[0x300] & 8 != 0 { pending & !self.csr[0x303] } else { 0 };
        let supervisor = if self.mode == crate::Mode::U || self.mode == crate::Mode::S && self.csr[0x300] & 2 != 0 { pending & self.csr[0x303] } else { 0 };
        if machine | supervisor != 0 { return 0; }
        self.memory.metrics.jit_lookups += 1;
        let pa = match self.memory.translate(self.pc, Access::Fetch, self.mode, self.csr[0x180], self.csr[0x300]) { Ok(p) => p, Err(_) => return 0 };
        if self.memory.shared_bytes != 0 {
            if let Some(index) = pa.checked_sub(crate::RAM_BASE).map(|off| (off >> 12) as usize) {
                if let Some(generation) = self.memory.jit_pages.get_mut(index) {
                    let mut observed = crate::wasm::shared_generation(index as u32);
                    // Generated stores bump only generations flagged as code
                    // (bit 31). Flag the page before any of its bytes are
                    // decoded for compilation; the flag itself is a change.
                    if observed & 0x8000_0000 == 0 { crate::wasm::shared_mark_code(index as u32); observed = crate::wasm::shared_generation(index as u32); }
                    let observed = observed as u64;
                    if *generation != observed { self.memory.metrics.shared_generation_changes += 1; }
                    *generation = observed;
                }
            }
        }
        let page = match pa.checked_sub(crate::RAM_BASE).and_then(|p| self.memory.jit_pages.get((p >> 12) as usize)) { Some(v) => *v, None => return 0 };
        // Translation and full fetch permission are revalidated on every entry.
        // Generated code depends on physical bytes and virtual PC, not satp/FS/SUM.
        let key = (pa, self.pc, page);
        if self.jit.entries.is_empty() { self.jit.entries = vec![None; 65536]; self.jit.chain = vec![ChainEntry::default(); 65536]; }
        let index = ((pa >> 1) ^ (pa >> 17) ^ (self.pc >> 33)) as usize & 65535;
        let slot = &mut self.jit.entries[index];
        if slot.as_ref().is_some_and(|e| e.key == key) { self.memory.metrics.jit_context_hits += 1; }
        if slot.as_ref().map_or(true, |e| e.key != key) { *slot = Some(Entry { key, hits: 0, id: 0, bytes: 0, compiled: None }); }
        let e = slot.as_mut().unwrap();
        if e.id == 0 {
            // Context keys can share immutable physical code; fetch/PMP is
            // revalidated below, and memory context is a per-call frame input.
            if let Some(&(id, bytes)) = self.jit.code.get(&(pa,self.pc,page)) { self.memory.metrics.jit_code_reuse += 1; e.id = id; e.bytes = bytes; }
        }
        e.hits = e.hits.saturating_add(1);
        if e.id == 0 && e.hits < self.jit.threshold { self.memory.metrics.jit_cold += 1; return 0; }
        if e.id == 0 {
            // Bound queued code as well as installed functions.
            if self.jit.code.len().saturating_sub(self.jit.ready.len()) >= 8192 {
                self.memory.metrics.jit_queue_full += 1;
                return if self.jit.threshold == 1 { u32::MAX } else { 0 };
            }
            // 0xffffffff marks a block that has no compilable prefix.
            let mut words = Vec::new(); let mut raw = Vec::new(); let mut p = pa; let mut pc = self.pc;
            for _ in 0..if self.jit.single_step { 1 } else { 64 } {
                if p >> 12 != pa >> 12 { break; }
                let d = match self.memory.decoded(p) { Some(d) => d, None => break };
                if !supported(d.ins) || self.memory.translate_size(pc, d.len as usize, Access::Fetch, self.mode, self.csr[0x180], self.csr[0x300]).is_err() { break; }
                words.extend_from_slice(&[d.ins, d.len as u32]); raw.push(d.raw);
                p += d.len; pc = pc.wrapping_add(d.len);
                if matches!(d.ins & 127, 0x67|0x6f|0x2f|0x07|0x27|0x43|0x47|0x4b|0x4f|0x53) { break; }
            }
            if words.is_empty() { e.id = u32::MAX; return 0; }
            self.jit.serial = self.jit.serial.checked_add(1).expect("JIT id exhausted");
            e.id = self.jit.serial;
            self.jit.last_used.resize(e.id as usize + 1, 0);
            e.bytes = words.chunks_exact(2).map(|w| w[1] as usize).sum();
            self.jit.code.insert((pa,self.pc,page), (e.id,e.bytes));
            self.jit.owners.insert(e.id, ((pa,self.pc,page), index as u32));
            compile(e.id, self.pc, &words, &raw, pa, page);
        }
        if e.id == u32::MAX { return 0; }
        if self.memory.translate_size(self.pc, e.bytes, Access::Fetch, self.mode, self.csr[0x180], self.csr[0x300]).is_err() { return 0; }
        let effective = if self.mode == crate::Mode::M && self.csr[0x300] & (1 << 17) != 0 { crate::Mode::from_bits(self.csr[0x300] >> 11 & 3) } else { self.mode };
        // ABI: next PC, executed count, RAM base/length, read/write TLBs,
        // code bitmap, privilege context, satp, store flag, budget, fault flag, Cpu.
        let mut frame = [self.pc, 0, self.memory.ram.as_ptr() as u64, self.memory.ram.len() as u64,
            self.memory.jit_tlb_ptr(1), self.memory.jit_tlb_ptr(2), self.memory.jit_code.as_ptr() as u64,
            effective as u64 | (self.csr[0x300] & ((1 << 18) | (1 << 19))), self.csr[0x180], 0, budget as u64, 0, cpu_ptr, 0, 0,
            self.memory.jit_tlb_ptr(0), self.memory.jit_pages.as_ptr() as u64, self.jit.chain.as_ptr() as u64,
            self.mode as u64 | (self.csr[0x300] & ((1 << 18) | (1 << 19))), 0,
            self.jit.last_used.as_ptr() as u64, self.memory.metrics.jit_dispatches + 1, 0, 0];
        if e.compiled.is_none() { e.compiled = self.jit.ready.get(&e.id).copied(); }
        let (slot, _length) = match e.compiled { Some((slot, n)) => { if n > budget { return 0; } (slot, n) }, _ => { self.memory.metrics.jit_pending += 1; return if self.jit.threshold == 1 { u32::MAX } else { 0 }; } };
        self.jit.chain[index] = ChainEntry { pc: self.pc, pa, generation: page, slot, count: _length, id: e.id, reserved: 0 };
        // The host installs only validated (i32,i32)->() wasm functions in this table.
        let function: unsafe extern "C" fn(*mut u64, *mut u64) = unsafe { std::mem::transmute(slot) };
        self.memory.metrics.jit_dispatches += 1;
        self.jit.last_used[e.id as usize] = self.memory.metrics.jit_dispatches;
        unsafe { function(self.x.as_mut_ptr(), frame.as_mut_ptr()); }
        self.memory.metrics.jit_chains += frame[19];
        self.memory.metrics.inline_loads += frame[22];
        self.memory.metrics.inline_stores += frame[23];
        if self.memory.shared_bytes != 0 {
            self.memory.metrics.smp_inline_loads += frame[22];
            self.memory.metrics.smp_inline_stores += frame[23];
            self.memory.metrics.smp_jit_chains += frame[19];
        }
        self.memory.metrics.inline_tlb_checks += frame[13];
        self.memory.metrics.inline_tlb_misses += frame[14];
        let n = frame[1] as u32;
        if frame[9] != 0 { self.reservation = None; }
        if n != 0 {
            self.jit.retired += n as u64 - frame[11];
            self.pc = frame[0];
            if self.csr[0x320] & 1 == 0 { self.cycles = self.cycles.wrapping_add(n as u64); }
            if self.csr[0x320] & 4 == 0 { self.retired = self.retired.wrapping_add(n as u64 - frame[11]); }
        }
        n
    }
}

/// Exact RAM slow path and single-hart A/F/D helper. Generated code spills before this call and
/// terminates the block afterward. This preserves soft-float flags/rounding,
/// LR/SC reservations and precise traps without JS reentry into Engine.
#[wasm_bindgen]
pub fn jit_slow(cpu_ptr: u32, ins: u32, raw: u32, len: u32, pc: u64, frame_ptr: u32) {
    // Pointers originate exclusively in jit_block's live call frame and Cpu.
    let cpu = unsafe { &mut *(cpu_ptr as *mut Cpu) };
    let frame = unsafe { &mut *(frame_ptr as *mut [u64; 24]) };
    if frame[9] != 0 { cpu.reservation = None; frame[9] = 0; }
    if matches!(ins & 127, 0x03|0x23) { cpu.memory.metrics.memory_helpers += 1; }
    cpu.pc = pc;
    if let Err(mut trap) = cpu.execute(ins, len as u64) {
        if trap.cause == 2 { trap.value = raw as u64; }
        cpu.trap(trap); frame[11] = 1;
    }
    cpu.x[0] = 0;
    frame[0] = cpu.pc;
}
