use crate::cpu::{Mode, Trap};

pub const RAM_BASE: u64 = 0x8000_0000;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Access {
    Fetch,
    Read,
    Write,
}
impl Access {
    fn page_fault(self, addr: u64) -> Trap {
        Trap {
            cause: match self {
                Self::Fetch => 12,
                Self::Read => 13,
                Self::Write => 15,
            },
            value: addr,
        }
    }
    fn fault(self, addr: u64) -> Trap {
        Trap {
            cause: match self {
                Self::Fetch => 1,
                Self::Read => 5,
                Self::Write => 7,
            },
            value: addr,
        }
    }
}
#[derive(Clone, Copy)]
#[repr(C)]
struct Tlb {
    tag: u64,
    pa: u64,
    context: u64,
    satp: u64,
    valid: bool,
    pmp_page: bool,
}
// Generated wasm uses this explicit C ABI, checked at compile time.
const _: () = {
    assert!(std::mem::size_of::<Tlb>() == 40);
    assert!(std::mem::offset_of!(Tlb, tag) == 0);
    assert!(std::mem::offset_of!(Tlb, pa) == 8);
    assert!(std::mem::offset_of!(Tlb, context) == 16);
    assert!(std::mem::offset_of!(Tlb, satp) == 24);
    assert!(std::mem::offset_of!(Tlb, valid) == 32);
    assert!(std::mem::offset_of!(Tlb, pmp_page) == 33);
};
const EMPTY: Tlb = Tlb {
    tag: 0,
    pa: 0,
    context: 0,
    satp: 0,
    valid: false,
    pmp_page: false,
};
use crate::decoded::Decoded;
#[derive(serde::Serialize, serde::Deserialize)]
pub struct Memory {
    /// Experimental external shared RAM; never serialized as a single-hart snapshot.
    #[serde(skip)]
    pub shared_bytes: usize,
    /// SMP: byte offset of this hart's store lock in the granule memory.
    #[serde(skip)]
    pub(crate) smp_lock: u64,
    #[serde(skip)]
    pub metrics: crate::metrics::Metrics,
    #[serde(skip)]
    pub(crate) jit_epoch: u64,
    #[serde(skip)]
    pub(crate) jit_pages: Vec<u64>,
    #[serde(skip)]
    // Live decoded/translated pages, not a sticky history of all executed RAM.
    // An invalidation advances the generation and clears this bit until refetch.
    pub(crate) jit_code: Vec<u8>,
    #[serde(with = "crate::snapshot::ram")]
    pub ram: Vec<u8>,
    #[serde(skip)]
    pub(crate) lazy_ram: Vec<bool>,
    #[cfg(not(target_arch = "wasm32"))]
    #[serde(skip)]
    pub page_loader: Option<fn(u32, &mut [u8])>,
    #[serde(skip)]
    code: Vec<Option<Box<[Decoded; 2048]>>>,
    pub devices: crate::devices::Devices,
    #[serde(skip, default = "empty_tlb")]
    tlb: [[Tlb; 256]; 3],
    pub time: u64,
    pub host_ticks: u64,
    pub mtimecmp: u64,
    pub msip: bool,
    pub adue: bool,
    pub pmpcfg: [u8; 16],
    pub pmpaddr: [u64; 16],
}
fn empty_tlb() -> [[Tlb; 256]; 3] { [[EMPTY; 256]; 3] }
impl Memory {
    pub fn ram_size(&self) -> usize { if self.shared_bytes == 0 { self.ram.len() } else { self.shared_bytes } }
    pub(crate) fn reset_caches(&mut self) {
        self.flush();
        self.jit_code = vec![0; (self.ram_size() + 4095) / 4096];
        self.jit_pages = vec![0; (self.ram_size() + 4095) / 4096];
        self.code = (0..(self.ram_size() + 4095) / 4096).map(|_| None).collect();
    }
    pub fn new(bytes: usize) -> Self {
        Self {
            shared_bytes: 0,
            smp_lock: 0,
            metrics: Default::default(),
            jit_epoch: 0,
            jit_code: vec![0; (bytes + 4095) / 4096],
            jit_pages: vec![0; (bytes + 4095) / 4096],
            devices: Default::default(),
            ram: vec![0; bytes],
            lazy_ram: vec![],
            #[cfg(not(target_arch = "wasm32"))]
            page_loader: None,
            code: (0..(bytes + 4095) / 4096).map(|_| None).collect(),
            tlb: [[EMPTY; 256]; 3],
            time: 0,
            host_ticks: 0,
            mtimecmp: u64::MAX,
            msip: false,
            adue: true,
            pmpcfg: [0; 16],
            pmpaddr: [0; 16],
        }
    }
    #[cfg(target_arch = "wasm32")]
    pub(crate) fn jit_tlb_ptr(&self, kind: usize) -> u64 { self.tlb[kind].as_ptr() as u64 }
    pub fn flush(&mut self) {
        self.metrics.tlb_flushes += 1;
        self.jit_epoch = self.jit_epoch.wrapping_add(1);
        self.tlb = [[EMPTY; 256]; 3];
    }
    pub(crate) fn ensure_ram(&mut self, start: usize, size: usize) {
        if self.lazy_ram.is_empty() || size == 0 || start.checked_add(size).map_or(true, |end| end > self.ram_size()) { return; }
        for index in start / 262144..=(start + size - 1) / 262144 {
            if self.lazy_ram[index] {
                let end = ((index + 1) * 262144).min(self.ram_size());
                let page = &mut self.ram[index * 262144..end];
                #[cfg(target_arch = "wasm32")]
                crate::wasm::snapshot_page(index as u32, page);
                #[cfg(not(target_arch = "wasm32"))]
                self.page_loader.expect("lazy snapshot requires a page loader")(index as u32, page);
                self.lazy_ram[index] = false;
            }
        }
    }
    pub fn load_image(&mut self, addr: u64, data: &[u8]) -> Result<(), Trap> {
        let start = addr
            .checked_sub(RAM_BASE)
            .filter(|off| *off <= self.ram_size() as u64)
            .ok_or(Access::Write.fault(addr))? as usize;
        let end = start
            .checked_add(data.len())
            .ok_or(Access::Write.fault(addr))?;
        self.ensure_ram(start, data.len());
        #[cfg(target_arch = "wasm32")]
        if self.shared_bytes != 0 {
            if end > self.shared_bytes { return Err(Access::Write.fault(addr)); }
            crate::wasm::shared_image(start as u32, data);
            return Ok(());
        }
        let dest = self
            .ram
            .get_mut(start..end)
            .ok_or(Access::Write.fault(addr))?;
        dest.copy_from_slice(data);
        if !data.is_empty() {
            for page in start / 4096..=(end - 1) / 4096 {
                if self.jit_code[page] != 0 { self.metrics.dma_code_pages += 1; self.jit_pages[page] = self.jit_pages[page].wrapping_add(1); self.jit_code[page] = 0; }
                self.code[page] = None;
            }
        }
        Ok(())
    }
    #[inline]
    pub fn physical_read(&mut self, addr: u64, size: usize, access: Access) -> Result<u64, Trap> {
        #[cfg(target_arch = "wasm32")]
        if self.shared_bytes != 0 {
            if let Some(off) = addr.checked_sub(RAM_BASE).filter(|off| off.checked_add(size as u64).is_some_and(|end| end <= self.shared_bytes as u64)) {
                if !matches!(size, 1 | 2 | 4 | 8) { return Err(access.fault(addr)); }
                return Ok(crate::wasm::shared_load(off as u32, size as u32));
            }
        }
        if let Some(off) = addr.checked_sub(RAM_BASE).filter(|off| *off <= self.ram_size() as u64) {
            self.ensure_ram(off as usize, size);
            if let Some(bytes) = self
                .ram
                .get(off as usize..(off as usize).saturating_add(size))
            {
                return Ok(match size {
                    1 => bytes[0] as u64,
                    2 => u16::from_le_bytes(bytes.try_into().unwrap()) as u64,
                    4 => u32::from_le_bytes(bytes.try_into().unwrap()) as u64,
                    8 => u64::from_le_bytes(bytes.try_into().unwrap()),
                    _ => return Err(access.fault(addr)),
                });
            }
        }
        match (addr, size) {
            (0x0200_0000, 4) => Ok(self.msip as u64),
            (0x0200_4000, 8) => Ok(self.mtimecmp),
            (0x0200_4000, 4) => Ok(self.mtimecmp as u32 as u64),
            (0x0200_4004, 4) => Ok(self.mtimecmp >> 32),
            (0x0200_bff8, 4) => Ok(self.time as u32 as u64),
            (0x0200_bffc, 4) => Ok(self.time >> 32),
            (0x0200_bff8, 8) => Ok(self.time),
            _ => Err(access.fault(addr)),
        }
    }
    #[inline]
    pub fn physical_write(&mut self, addr: u64, size: usize, value: u64) -> Result<(), Trap> {
        #[cfg(target_arch = "wasm32")]
        if self.shared_bytes != 0 {
            if let Some(off) = addr.checked_sub(RAM_BASE).filter(|off| off.checked_add(size as u64).is_some_and(|end| end <= self.shared_bytes as u64)) {
                if !matches!(size, 1 | 2 | 4 | 8) { return Err(Access::Write.fault(addr)); }
                crate::wasm::shared_store(off as u32, size as u32, value);
                return Ok(());
            }
        }
        if let Some(off) = addr.checked_sub(RAM_BASE).filter(|off| *off <= self.ram_size() as u64) {
            self.ensure_ram(off as usize, size);
            if let Some(bytes) = self
                .ram
                .get_mut(off as usize..(off as usize).saturating_add(size))
            {
                if !matches!(size, 1 | 2 | 4 | 8) { return Err(Access::Write.fault(addr)); }
                bytes.copy_from_slice(&value.to_le_bytes()[..size]);
                let first = off as usize / 4096;
                let last = (off as usize + size - 1) / 4096;
                if self.jit_code[first] != 0 { self.metrics.store_code_pages += 1; self.jit_pages[first] = self.jit_pages[first].wrapping_add(1); self.jit_code[first] = 0; }
                if last != first && self.jit_code[last] != 0 { self.metrics.store_code_pages += 1; self.jit_pages[last] = self.jit_pages[last].wrapping_add(1); self.jit_code[last] = 0; }
                self.code[first] = None;
                if last != first { self.code[last] = None; }
                return Ok(());
            }
        }
        match (addr, size) {
            (0x0200_0000, 4) => self.msip = value & 1 != 0,
            (0x0200_4000, 8) => self.mtimecmp = value,
            (0x0200_4000, 4) => self.mtimecmp = (self.mtimecmp & !0xffffffff) | (value & 0xffffffff),
            (0x0200_4004, 4) => self.mtimecmp = (self.mtimecmp & 0xffffffff) | (value << 32),
            (0x0200_bff8, 8) => self.time = value,
            (0x0200_bff8, 4) => self.time = (self.time & !0xffffffff) | (value & 0xffffffff),
            (0x0200_bffc, 4) => self.time = (self.time & 0xffffffff) | (value << 32),
            _ => return Err(Access::Write.fault(addr)),
        }
        Ok(())
    }
    /// Bulk device DMA into guest RAM. One shared-bus transaction per buffer:
    /// SMP harts observe the same lock, reservation-granule and code-page
    /// generation protocol as for individual stores.
    pub fn dma_write(&mut self, addr: u64, data: &[u8]) -> Result<(), ()> {
        if data.is_empty() { return Ok(()); }
        let off = self.dma_offset(addr, data.len())?;
        #[cfg(target_arch = "wasm32")]
        if self.shared_bytes != 0 { crate::wasm::shared_dma_write(off as u32, data); return Ok(()); }
        self.ensure_ram(off, data.len());
        self.ram[off..off + data.len()].copy_from_slice(data);
        for page in off / 4096..=(off + data.len() - 1) / 4096 {
            if self.jit_code[page] != 0 { self.metrics.dma_code_pages += 1; self.jit_pages[page] = self.jit_pages[page].wrapping_add(1); self.jit_code[page] = 0; }
            self.code[page] = None;
        }
        Ok(())
    }
    pub fn dma_read(&mut self, addr: u64, out: &mut [u8]) -> Result<(), ()> {
        if out.is_empty() { return Ok(()); }
        let off = self.dma_offset(addr, out.len())?;
        #[cfg(target_arch = "wasm32")]
        if self.shared_bytes != 0 { crate::wasm::shared_dma_read(off as u32, out); return Ok(()); }
        self.ensure_ram(off, out.len());
        out.copy_from_slice(&self.ram[off..off + out.len()]);
        Ok(())
    }
    fn dma_offset(&self, addr: u64, len: usize) -> Result<usize, ()> {
        let off = addr.checked_sub(RAM_BASE).ok_or(())?;
        if off.checked_add(len as u64).ok_or(())? > self.ram_size() as u64 { return Err(()); }
        Ok(off as usize)
    }
    // Cache is physically indexed. Every RAM writer, including virtqueue DMA,
    // goes through physical_write/load_image and invalidates the affected page.
    pub fn decoded(&mut self, pa: u64) -> Option<Decoded> {
        #[cfg(target_arch = "wasm32")]
        if self.shared_bytes != 0 {
            let off = pa.checked_sub(RAM_BASE)?;
            if off & 1 != 0 || off & 4095 == 4094 || off + 4 > self.shared_bytes as u64 { return None; }
            let raw = crate::wasm::shared_fetch(off as u32);
            return if raw & 3 == 3 { Some(Decoded::new(raw, raw, 4)) }
                else { Some(Decoded::new(raw & 65535, crate::compressed::expand(raw as u16)?, 2)) };
        }
        let off = pa.checked_sub(RAM_BASE).filter(|off| *off < self.ram_size() as u64)? as usize;
        if off & 1 != 0 || off.checked_add(4)? > self.ram_size() || off & 4095 == 4094 { return None; }
        let page = off / 4096;
        let slot = (off & 4095) / 2;
        if let Some(cache) = &self.code[page] {
            if cache[slot].len != 0 { return Some(cache[slot]); }
        }
        self.ensure_ram(off, 4);
        self.jit_code[page] = 1;
        let raw = u32::from_le_bytes(self.ram[off..off + 4].try_into().unwrap());
        let d = if raw & 3 == 3 { Decoded::new(raw, raw, 4) }
            else { Decoded::new(raw & 65535, crate::compressed::expand(raw as u16)?, 2) };
        let cache = self.code[page].get_or_insert_with(|| vec![Decoded::default(); 2048].into_boxed_slice().try_into().ok().unwrap());
        cache[slot] = d;
        Some(d)
    }
    #[inline]
    pub fn pmp_check(&self, addr: u64, size: usize, access: Access, mode: Mode) -> Result<(), Trap> {
        // Common firmware policy: an unlocked all-address-space NAPOT entry.
        if self.pmpcfg[0] == 0x1f && self.pmpaddr[0] == (1u64 << 54) - 1 && addr.checked_add(size as u64).map_or(false, |end| end <= (1u64 << 56)) { return Ok(()); }
        let end = (addr as u128) + size as u128;
        for i in 0..16 {
            let cfg = self.pmpcfg[i];
            let (lo, hi) = match (cfg >> 3) & 3 {
                0 => continue,
                1 => (if i == 0 { 0 } else { (self.pmpaddr[i-1] as u128) << 2 }, (self.pmpaddr[i] as u128) << 2),
                2 => ((self.pmpaddr[i] as u128) << 2, ((self.pmpaddr[i] as u128) << 2) + 4),
                _ => { let bits = self.pmpaddr[i].trailing_ones(); let size = 1u128 << (bits + 3); let lo = ((self.pmpaddr[i] as u128) << 2) & !(size - 1); (lo, lo + size) }
            };
            if lo >= hi || end <= lo || addr as u128 >= hi { continue; }
            let bit = match access { Access::Fetch => 4, Access::Read => 1, Access::Write => 2 };
            return if addr as u128 >= lo && end <= hi && (mode == Mode::M && cfg & 128 == 0 || cfg & bit != 0) { Ok(()) } else { Err(access.fault(addr)) };
        }
        if mode == Mode::M { Ok(()) } else { Err(access.fault(addr)) }
    }
    pub fn translate(&mut self, va: u64, access: Access, mode: Mode, satp: u64, status: u64) -> Result<u64, Trap> {
        self.translate_size(va, 1, access, mode, satp, status)
    }
    #[inline(always)]
    pub fn translate_size(&mut self, va: u64, size: usize, access: Access, mode: Mode, satp: u64, status: u64) -> Result<u64, Trap> {
        self.metrics.tlb_requests += 1;
        let effective = if access != Access::Fetch && mode == Mode::M && status & (1 << 17) != 0 { Mode::from_bits((status >> 11) & 3) } else { mode };
        let context = effective as u64 | (status & ((1 << 18) | (1 << 19)));
        let index = ((va >> 12) & 255) as usize;
        let kind = access as usize;
        let hit = self.tlb[kind][index];
        if hit.valid && hit.pmp_page && hit.tag == va >> 12 && hit.context == context && hit.satp == satp
            && effective != Mode::M && satp >> 60 == 8 && (va & 4095) + size as u64 <= 4096 {
            return Ok(hit.pa | (va & 4095));
        }
        let pa = self.translate_inner(va, access, mode, satp, status)?;
        self.pmp_check(pa, size, access, effective).map_err(|t| Trap { value: va, ..t })?;
        // A JIT TLB entry may enable raw wasm RAM loads/stores. Hydrate the
        // physical page BEFORE setting pmp_page; interpreter, PTE A/D and DMA
        // accesses also hydrate through physical_read/write/load_image.
        if let Some(off) = pa.checked_sub(RAM_BASE) { self.ensure_ram(off as usize, size); }
        if effective != Mode::M && satp >> 60 == 8 && self.pmp_check(pa & !4095, 4096, access, effective).is_ok() {
            self.tlb[kind][index].pmp_page = true;
        }
        Ok(pa)
    }
    #[inline(always)]
    fn translate_inner(
        &mut self,
        va: u64,
        access: Access,
        mode: Mode,
        satp: u64,
        status: u64,
    ) -> Result<u64, Trap> {
        let effective = if access != Access::Fetch && mode == Mode::M && status & (1 << 17) != 0 {
            Mode::from_bits((status >> 11) & 3)
        } else {
            mode
        };
        if effective == Mode::M || satp >> 60 == 0 {
            return Ok(va);
        }
        let fault = access.page_fault(va);
        if satp >> 60 != 8 || ((va as i64) << 25 >> 25) as u64 != va {
            return Err(fault);
        }
        let context = effective as u64 | (status & ((1 << 18) | (1 << 19)));
        let index = ((va >> 12) & 255) as usize;
        let kind = match access {
            Access::Fetch => 0,
            Access::Read => 1,
            Access::Write => 2,
        };
        let hit = self.tlb[kind][index];
        if hit.valid && hit.tag == va >> 12 && hit.context == context && hit.satp == satp {
            return Ok(hit.pa | (va & 4095));
        }
        self.walk(va, access, effective, satp, status, kind, index, context)
    }
    #[cold]
    #[inline(never)]
    fn walk(&mut self, va: u64, access: Access, effective: Mode, satp: u64, status: u64, kind: usize, index: usize, context: u64) -> Result<u64, Trap> {
        let fault = access.page_fault(va);
        self.metrics.tlb_walks += 1;
        let mut table = (satp & ((1 << 44) - 1)) << 12;
        for level in (0..=2).rev() {
            let pte_addr = table + ((va >> (12 + 9 * level)) & 511) * 8;
            self.pmp_check(pte_addr, 8, Access::Read, Mode::S).map_err(|_| access.fault(va))?;
            let mut pte = self
                .physical_read(pte_addr, 8, Access::Read)
                .map_err(|_| access.fault(va))?;
            #[cfg(target_arch = "wasm32")]
            let original_pte = pte;
            if pte & 1 == 0 || pte & 6 == 4 || pte >> 54 != 0 {
                return Err(fault);
            }
            if pte & 10 == 0 {
                if level == 0 || pte & 0xd0 != 0 {
                    return Err(fault);
                }
                table = (pte >> 10) << 12;
                continue;
            }
            let user = pte & 16 != 0;
            if effective == Mode::U && !user {
                return Err(fault);
            }
            if effective == Mode::S && user && (access == Access::Fetch || status & (1 << 18) == 0)
            {
                return Err(fault);
            }
            let allowed = match access {
                Access::Fetch => pte & 8 != 0,
                Access::Read => pte & 2 != 0 || (pte & 8 != 0 && status & (1 << 19) != 0),
                Access::Write => pte & 4 != 0,
            };
            if !allowed {
                return Err(fault);
            }
            let low_mask = (1u64 << (12 + 9 * level)) - 1;
            let base = (pte >> 10) << 12;
            if base & low_mask != 0 {
                return Err(fault);
            }
            let ad = 64 | if access == Access::Write { 128 } else { 0 };
            if pte & ad != ad {
                if !self.adue { return Err(fault); }
                pte |= ad;
                self.pmp_check(pte_addr, 8, Access::Write, Mode::S).map_err(|_| access.fault(va))?;
                #[cfg(target_arch = "wasm32")]
                if self.shared_bytes != 0 {
                    // Restart the walk if another hart changed the PTE.
                    let old = crate::wasm::shared_cas((pte_addr - RAM_BASE) as u32, original_pte, pte);
                    if old != original_pte { return self.walk(va, access, effective, satp, status, kind, index, context); }
                } else { self.physical_write(pte_addr, 8, pte).map_err(|_| access.fault(va))?; }
                #[cfg(not(target_arch = "wasm32"))]
                self.physical_write(pte_addr, 8, pte).map_err(|_| access.fault(va))?;
            }
            let pa = base | (va & low_mask);
            self.tlb[kind][index] = Tlb {
                tag: va >> 12,
                pa: pa & !4095,
                context,
                satp,
                valid: true,
                pmp_page: false,
            };
            return Ok(pa);
        }
        Err(fault)
    }
}
