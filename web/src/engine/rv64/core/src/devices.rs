//! Modern virtio-mmio split queues and a single-hart PLIC.
use crate::{Access, Memory};
use std::collections::VecDeque;
#[derive(Clone, Copy, Default, serde::Serialize, serde::Deserialize)]
struct Queue {
    size: u32,
    ready: u32,
    desc: u64,
    avail: u64,
    used: u64,
    last: u16,
}
#[derive(serde::Serialize, serde::Deserialize)]
struct Virtio {
    id: u32,
    feature_sel: u32,
    driver_sel: u32,
    driver: u64,
    queue: u32,
    status: u32,
    irq: u32,
    queues: [Queue; 2],
}
impl Virtio {
    fn new(id: u32) -> Self {
        Self {
            id,
            feature_sel: 0,
            driver_sel: 0,
            driver: 0,
            queue: 0,
            status: 0,
            irq: 0,
            queues: [Queue::default(); 2],
        }
    }
}
#[derive(serde::Serialize, serde::Deserialize)]
pub struct Devices {
    dev: [Virtio; 4],
    priority: [u32; 32],
    enable: [u32; 2],
    threshold: [u32; 2],
    claimed: u32,
    #[serde(skip)]
    pub(crate) extra_enable: [u32; 6],
    #[serde(skip)]
    pub(crate) extra_threshold: [u32; 6],
    pub console: Vec<u8>,
    pub input: VecDeque<u8>,
    pub entropy: VecDeque<u8>,
    pub mac: [u8; 6],
    pub disk: Vec<u8>,
    pub disk_bytes: u64,
    #[serde(skip)]
    pub disk_dirty: std::collections::BTreeSet<u64>,
    pub disk_chunks: std::collections::BTreeMap<u64, Vec<u8>>,
    pub disk_missing: Vec<u64>,
    pub net_rx: VecDeque<Vec<u8>>,
    pub net_tx: VecDeque<Vec<u8>>,
}
impl Default for Devices {
    fn default() -> Self {
        Self {
            dev: [
                Virtio::new(2),
                Virtio::new(1),
                Virtio::new(3),
                Virtio::new(4),
            ],
            priority: [0; 32],
            enable: [0; 2],
            threshold: [0; 2],
            claimed: 0,
            extra_enable: [0; 6],
            extra_threshold: [0; 6],
            console: vec![],
            input: VecDeque::new(),
            entropy: VecDeque::new(),
            mac: [2, 0x44, 0x54, 0, 0, 1],
            disk: vec![],
            disk_bytes: 0,
            disk_chunks: Default::default(),
            disk_dirty: Default::default(),
            disk_missing: vec![],
            net_rx: VecDeque::new(),
            net_tx: VecDeque::new(),
        }
    }
}
impl Devices {
    #[cfg(not(target_arch = "wasm32"))]
    pub fn diagnostics(&self, mem: &Memory) -> String {
        // Diagnostics never fault pages in or mutate the inspected machine.
        let peek = |addr: u64| -> Option<u16> {
            let off = addr.checked_sub(crate::RAM_BASE)? as usize;
            if mem.lazy_ram.get(off / 262144).copied().unwrap_or(false) { return None; }
            Some(u16::from_le_bytes(mem.ram.get(off..off.checked_add(2)?)?.try_into().ok()?))
        };
        self.dev.iter().map(|d| format!("id={} status={:#x} irq={} queues={:?}", d.id, d.status, d.irq,
            d.queues.iter().map(|q| (q.ready, q.size, q.last, peek(q.avail+2),peek(q.used+2))).collect::<Vec<_>>() )).collect::<Vec<_>>().join("\n")
    }

    pub const BLOCK_CHUNK: u64 = 256 * 1024;
    pub fn disk_size(&self) -> u64 { if self.disk_bytes != 0 { self.disk_bytes } else { self.disk.len() as u64 } }
    pub fn disk_chunk(&mut self, index: u64, data: Vec<u8>) -> Result<(), String> {
        let start = index.checked_mul(Self::BLOCK_CHUNK).ok_or("disk chunk overflow")?;
        let expected = self.disk_bytes.saturating_sub(start).min(Self::BLOCK_CHUNK) as usize;
        if expected == 0 || data.len() != expected { return Err("invalid disk chunk length".into()); }
        self.disk_chunks.entry(index).or_insert(data);
        Ok(())
    }

    fn features(id: u32) -> u64 {
        (1 << 32) | match id { 2 => (1 << 2) | (1 << 6) | (1 << 9), 1 => (1 << 5) | (1 << 16), _ => 0 }
    }
    fn pending(&self) -> u32 {
        self.dev
            .iter()
            .enumerate()
            .fold(0, |p, (i, d)| p | if d.irq != 0 { 1 << (i + 1) } else { 0 })
            & !self.claimed
    }
    fn enabled(&self, ctx: usize) -> u32 { if ctx < 2 { self.enable[ctx] } else { self.extra_enable[ctx - 2] } }
    fn limit(&self, ctx: usize) -> u32 { if ctx < 2 { self.threshold[ctx] } else { self.extra_threshold[ctx - 2] } }
    pub fn hart_interrupts(&self, hart: usize) -> u64 {
        if hart >= 4 { return 0; }
        ((self.best(hart * 2, self.limit(hart * 2)) != 0) as u64) << 11 |
        ((self.best(hart * 2 + 1, self.limit(hart * 2 + 1)) != 0) as u64) << 9
    }
    fn best(&self, ctx: usize, threshold: u32) -> u32 {
        let p = self.pending() & self.enabled(ctx);
        let mut best = 0;
        let mut priority = threshold;
        for i in 1..32 {
            if p & (1 << i) != 0 && self.priority[i] > priority {
                best = i;
                priority = self.priority[i];
            }
        }
        best as u32
    }
    pub fn interrupts(&self) -> u64 {
        ((self.best(0, self.threshold[0]) != 0) as u64) << 11 | ((self.best(1, self.threshold[1]) != 0) as u64) << 9
    }
    pub fn read(&mut self, addr: u64) -> Option<u64> {
        if (0xc000000..0x10000000).contains(&addr) {
            let off = addr - 0xc000000;
            return Some(match off {
                0..=0x7c => self.priority[(off / 4) as usize],
                0x1000 => self.pending(),
                0x2000 => self.enable[0],
                0x2080 => self.enable[1],
                0x200000 => self.threshold[0],
                0x201000 => self.threshold[1],
                0x2100..=0x2380 if off % 128 == 0 => self.extra_enable[((off - 0x2100) / 128) as usize],
                0x202000..=0x207000 if off % 4096 == 0 => self.extra_threshold[((off - 0x202000) / 4096) as usize],
                0x200004..=0x207004 if off % 4096 == 4 => {
                    let v = self.best(((off - 0x200004) / 4096) as usize, 0);
                    if v != 0 {
                        self.claimed |= 1 << v;
                    }
                    v
                }
                _ => 0,
            } as u64);
        }
        if !(0x10000000..0x10004000).contains(&addr) {
            return None;
        }
        let d = &self.dev[((addr - 0x10000000) / 4096) as usize];
        let off = addr & 4095;
        let q = d.queues.get(d.queue as usize).copied().unwrap_or_default();
        Some(match off {
            0 => 0x74726976,
            4 => 2,
            8 => d.id,
            12 => 0x4454524e,
            0x10 => if d.feature_sel < 2 { (Self::features(d.id) >> (d.feature_sel * 32)) as u32 } else { 0 },
            0x34 => {
                if d.queue < 2 {
                    128
                } else {
                    0
                }
            }
            0x38 => q.size,
            0x44 => q.ready,
            0x60 => d.irq,
            0x70 => d.status,
            0xfc => 0,
            0x100 if d.id == 2 => (self.disk_size() / 512) as u32,
            0x104 if d.id == 2 => ((self.disk_size() / 512) >> 32) as u32,
            0x10c if d.id == 2 => 126,
            0x114 if d.id == 2 => 512,
            0x120 if d.id == 2 => 1 | (1 << 16),
            0x100 if d.id == 1 => u32::from_le_bytes(self.mac[..4].try_into().unwrap()),
            0x104 if d.id == 1 => self.mac[4] as u32 | ((self.mac[5] as u32) << 8) | (1 << 16),
            0x108 if d.id == 1 => 1,
            _ => 0,
        } as u64)
    }
    pub fn write(&mut self, addr: u64, v: u32) -> bool {
        if (0xc000000..0x10000000).contains(&addr) {
            let off = addr - 0xc000000;
            match off {
                4..=0x7c => self.priority[(off / 4) as usize] = v & 7,
                0x2000 => self.enable[0] = v,
                0x2080 => self.enable[1] = v,
                0x200000 => self.threshold[0] = v & 7,
                0x201000 => self.threshold[1] = v & 7,
                0x2100..=0x2380 if off % 128 == 0 => self.extra_enable[((off - 0x2100) / 128) as usize] = v,
                0x202000..=0x207000 if off % 4096 == 0 => self.extra_threshold[((off - 0x202000) / 4096) as usize] = v & 7,
                0x200004..=0x207004 if off % 4096 == 4 && v < 32 => {
                    let ctx = ((off - 0x200004) / 4096) as usize;
                    if self.enabled(ctx) & (1 << v) != 0 { self.claimed &= !(1 << v); }
                }
                _ => {}
            }
            return true;
        }
        if !(0x10000000..0x10004000).contains(&addr) {
            return false;
        }
        let d = &mut self.dev[((addr - 0x10000000) / 4096) as usize];
        let off = addr & 4095;
        match off {
            0x14 => d.feature_sel = v,
            0x24 => d.driver_sel = v,
            0x20 if d.driver_sel < 2 => {
                let shift = d.driver_sel * 32;
                d.driver = (d.driver & !(0xffffffffu64 << shift)) | ((v as u64) << shift)
            }
            0x30 => d.queue = v,
            0x64 => d.irq &= !v,
            0x70 => {
                if v == 0 {
                    *d = Virtio::new(d.id)
                } else {
                    d.status = v;
                    if v & 8 != 0 && (d.driver & !Self::features(d.id) != 0 || d.driver & (1 << 32) == 0) {
                        d.status &= !8
                    }
                }
            }
            _ => {
                if let Some(q) = d.queues.get_mut(d.queue as usize) {
                    match off {
                        0x38 if v <= 128 && v.is_power_of_two() => q.size = v,
                        0x44 => q.ready = v & 1,
                        0x80 => q.desc = (q.desc & !0xffffffff) | v as u64,
                        0x84 => q.desc = (q.desc & 0xffffffff) | ((v as u64) << 32),
                        0x90 => q.avail = (q.avail & !0xffffffff) | v as u64,
                        0x94 => q.avail = (q.avail & 0xffffffff) | ((v as u64) << 32),
                        0xa0 => q.used = (q.used & !0xffffffff) | v as u64,
                        0xa4 => q.used = (q.used & 0xffffffff) | ((v as u64) << 32),
                        _ => {}
                    }
                }
            }
        }
        true
    }
    pub fn service(&mut self, mem: &mut Memory) {
        for dev in 0..4 {
            for qi in 0..2 {
                if self.dev[dev].status & 4 == 0 || self.dev[dev].status & (128 | 64) != 0 {
                    continue;
                }
                let mut q = self.dev[dev].queues[qi];
                if q.ready == 0 || q.size == 0 {
                    continue;
                }
                if !range(mem, q.desc, q.size as u64 * 16)
                    || !range(mem, q.avail, 6 + q.size as u64 * 2)
                    || !range(mem, q.used, 6 + q.size as u64 * 8)
                {
                    self.dev[dev].status |= 64; self.dev[dev].irq |= 2;
                    continue;
                }
                let Ok(avail) = read(mem, q.avail + 2, 2) else {
                    self.dev[dev].status |= 64; self.dev[dev].irq |= 2;
                    continue;
                };
                if (avail as u16).wrapping_sub(q.last) > q.size as u16 {
                    self.dev[dev].status |= 64; self.dev[dev].irq |= 2;
                    continue;
                }
                for _ in 0..q.size {
                    if q.last == avail as u16 {
                        break;
                    }
                    if (dev == 2 && qi == 0 && self.input.is_empty())
                        || (dev == 3 && self.entropy.is_empty())
                        || (dev == 1 && qi == 0 && self.net_rx.is_empty())
                    {
                        break;
                    }
                    // Keep the descriptor pending while the host fetches immutable base
                    // chunks. Preflight the whole request before any guest/DMA mutation.
                    if dev == 0 && qi == 0 && self.disk_bytes != 0 {
                        if let Ok(head) = read(mem, q.avail + 4 + 2 * (q.last as u64 % q.size as u64), 2) {
                            if let Ok(ds) = chain(mem, q, head as u16) {
                                if ds.len() >= 2 {
                                    if let (Ok(op), Ok(sector)) = (read(mem, ds[0].addr, 4), read(mem, ds[0].addr + 8, 8)) {
                                        let bytes: u64 = ds[1..ds.len()-1].iter().map(|d| d.len as u64).sum();
                                        if let Some(start) = sector.checked_mul(512) {
                                            if op <= 1 && bytes > 0 && start.checked_add(bytes).map_or(false, |end| end <= self.disk_bytes) {
                                                for i in start / Self::BLOCK_CHUNK..=(start + bytes - 1) / Self::BLOCK_CHUNK {
                                                    if !self.disk_chunks.contains_key(&i) && !self.disk_missing.contains(&i) { self.disk_missing.push(i); }
                                                }
                                                if !self.disk_missing.is_empty() { break; }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    let result = (|| -> Result<(), ()> {
                        let head =
                            read(mem, q.avail + 4 + 2 * (q.last as u64 % q.size as u64), 2)? as u16;
                        let chain = chain(mem, q, head)?;
                        let mut written = 0;
                        match (dev, qi) {
                            (2, 1) => {
                                for d in &chain {
                                    if d.flags & 2 != 0 {
                                        return Err(());
                                    }
                                    let data = bytes(mem, d.addr, d.len)?;
                                    self.console.extend(data);
                                }
                            }
                            (2, 0) | (3, 0) => {
                                let source = if dev == 2 {
                                    &mut self.input
                                } else {
                                    &mut self.entropy
                                };
                                for d in &chain {
                                    if d.flags & 2 == 0 {
                                        return Err(());
                                    }
                                    for j in 0..d.len {
                                        let Some(b) = source.pop_front() else { break };
                                        write(mem, d.addr + j as u64, 1, b as u64)?;
                                        written += 1;
                                    }
                                }
                            }
                            (1, 1) => {
                                let mut frame = Vec::new();
                                for d in &chain {
                                    if d.flags & 2 != 0 {
                                        return Err(());
                                    }
                                    frame.extend(bytes(mem, d.addr, d.len)?);
                                }
                                if frame.len() >= 12 + 14 { self.net_tx.push_back(frame[12..].to_vec()); }
                            }
                            (1, 0) => {
                                let frame = self.net_rx.pop_front().ok_or(())?;
                                let mut header = vec![0; 12];
                                header[10] = 1; // Modern virtio_net_hdr.num_buffers, not an Ethernet header.
                                let data = [header, frame].concat();
                                let mut pos = 0;
                                for d in &chain {
                                    if d.flags & 2 == 0 {
                                        return Err(());
                                    }
                                    for j in 0..d.len {
                                        if pos == data.len() {
                                            break;
                                        }
                                        write(mem, d.addr + j as u64, 1, data[pos] as u64)?;
                                        pos += 1;
                                        written += 1;
                                    }
                                }
                            }
                            (0, 0) => {
                                if chain.len() < 2 {
                                    return Err(());
                                }
                                let h = chain[0];
                                let end = *chain.last().unwrap();
                                if h.flags & 2 != 0
                                    || h.len < 16
                                    || end.flags & 2 == 0
                                    || end.len < 1
                                {
                                    return Err(());
                                }
                                let op = read(mem, h.addr, 4)?;
                                let sector = read(mem, h.addr + 8, 8)?;
                                let mut offset = sector.checked_mul(512).ok_or(())?;
                                let mut status = 0u64;
                                if op == 4 {
                                    // RAM-backed overlay writes are committed before completing OUT.
                                } else if op > 1 {
                                    status = 2
                                } else {
                                    for d in &chain[1..chain.len() - 1] {
                                        if (op == 0) != (d.flags & 2 != 0) {
                                            return Err(());
                                        }
                                        let stop = offset.checked_add(d.len as u64).ok_or(())?;
                                        if stop > self.disk_size() {
                                            status = 1;
                                            break;
                                        }
                                        for j in 0..d.len {
                                            if op == 0 {
                                                write(
                                                    mem,
                                                    d.addr + j as u64,
                                                    1,
                                                    if self.disk_bytes == 0 { self.disk[offset as usize + j as usize] as u64 }
                                                    else { let p = offset + j as u64; self.disk_chunks[&(p / Self::BLOCK_CHUNK)][(p % Self::BLOCK_CHUNK) as usize] as u64 },
                                                )?;
                                                written += 1
                                            } else {
                                                let value = read(mem, d.addr + j as u64, 1)? as u8;
                                                if self.disk_bytes == 0 { self.disk[offset as usize + j as usize] = value; }
                                                else { let p = offset + j as u64; self.disk_dirty.insert(p / Self::BLOCK_CHUNK); self.disk_chunks.get_mut(&(p / Self::BLOCK_CHUNK)).ok_or(())?[(p % Self::BLOCK_CHUNK) as usize] = value; }
                                            }
                                        }
                                        offset = stop;
                                    }
                                }
                                write(mem, end.addr, 1, status)?;
                                written += 1;
                            }
                            _ => return Err(()),
                        }
                        let used = read(mem, q.used + 2, 2)? as u16;
                        let slot = q.used + 4 + (used as u64 % q.size as u64) * 8;
                        write(mem, slot, 4, head as u64)?;
                        write(mem, slot + 4, 4, written)?;
                        write(mem, q.used + 2, 2, used.wrapping_add(1) as u64)?;
                        q.last = q.last.wrapping_add(1);
                        if read(mem, q.avail, 2)? & 1 == 0 { self.dev[dev].irq |= 1; }
                        Ok(())
                    })();
                    if result.is_err() {
                        self.dev[dev].status |= 64; self.dev[dev].irq |= 2;
                        break;
                    }
                }
                self.dev[dev].queues[qi] = q;
            }
        }
    }
}
#[derive(Clone, Copy)]
struct Desc {
    addr: u64,
    len: u32,
    flags: u16,
}
fn chain(mem: &mut Memory, q: Queue, mut idx: u16) -> Result<Vec<Desc>, ()> {
    let mut out = Vec::new();
    let mut total = 0u64;
    for _ in 0..q.size {
        if idx as u32 >= q.size {
            return Err(());
        }
        let p = q.desc + idx as u64 * 16;
        let addr = read(mem, p, 8)?;
        let len = read(mem, p + 8, 4)? as u32;
        let flags = read(mem, p + 12, 2)? as u16;
        total += len as u64;
        // Linux may submit a 1 MiB data request plus its header/status. No
        // SIZE_MAX is advertised, so a private 1 MiB chain limit is invalid.
        // Bound the used length to its u32 wire representation; every buffer
        // is independently RAM-checked below and traversal is queue-bounded.
        if total > u32::MAX as u64 || flags & 4 != 0 {
            return Err(());
        }
        if len != 0 {
            read(mem, addr, 1)?;
            read(mem, addr.checked_add(len as u64 - 1).ok_or(())?, 1)?;
        }
        out.push(Desc { addr, len, flags });
        if flags & 1 == 0 {
            return Ok(out);
        }
        idx = read(mem, p + 14, 2)? as u16;
    }
    Err(())
}
fn read(mem: &mut Memory, addr: u64, n: usize) -> Result<u64, ()> {
    let off = addr.checked_sub(crate::RAM_BASE).ok_or(())?;
    if off.checked_add(n as u64).ok_or(())? > mem.ram_size() as u64 {
        return Err(());
    }
    mem.physical_read(addr, n, Access::Read).map_err(|_| ())
}
fn write(mem: &mut Memory, addr: u64, n: usize, v: u64) -> Result<(), ()> {
    read(mem, addr, n)?;
    mem.physical_write(addr, n, v).map_err(|_| ())
}
fn bytes(mem: &mut Memory, addr: u64, n: u32) -> Result<Vec<u8>, ()> {
    (0..n)
        .map(|j| read(mem, addr + j as u64, 1).map(|v| v as u8))
        .collect()
}

fn range(mem: &Memory, addr: u64, size: u64) -> bool {
    addr.checked_sub(crate::RAM_BASE)
        .and_then(|off| off.checked_add(size))
        .is_some_and(|end| end <= mem.ram_size() as u64)
}
