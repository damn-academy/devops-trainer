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
    #[serde(skip)]
    pub(crate) jit_epoch: u64,
    #[serde(skip)]
    pub(crate) jit_pages: Vec<u64>,
    #[serde(skip)]
    pub(crate) jit_code: Vec<u8>,
    #[serde(with = "crate::snapshot::ram")]
    pub ram: Vec<u8>,
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
    pub(crate) fn reset_caches(&mut self) {
        self.flush();
        self.jit_code = vec![0; (self.ram.len() + 4095) / 4096];
        self.jit_pages = vec![0; (self.ram.len() + 4095) / 4096];
        self.code = (0..(self.ram.len() + 4095) / 4096).map(|_| None).collect();
    }
    pub fn new(bytes: usize) -> Self {
        Self {
            jit_epoch: 0,
            jit_code: vec![0; (bytes + 4095) / 4096],
            jit_pages: vec![0; (bytes + 4095) / 4096],
            devices: Default::default(),
            ram: vec![0; bytes],
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
        self.jit_epoch = self.jit_epoch.wrapping_add(1);
        self.tlb = [[EMPTY; 256]; 3];
    }
    pub fn load_image(&mut self, addr: u64, data: &[u8]) -> Result<(), Trap> {
        let start = addr
            .checked_sub(RAM_BASE)
            .filter(|off| *off <= self.ram.len() as u64)
            .ok_or(Access::Write.fault(addr))? as usize;
        let end = start
            .checked_add(data.len())
            .ok_or(Access::Write.fault(addr))?;
        let dest = self
            .ram
            .get_mut(start..end)
            .ok_or(Access::Write.fault(addr))?;
        dest.copy_from_slice(data);
        if !data.is_empty() {
            for page in start / 4096..=(end - 1) / 4096 {
                if self.jit_code[page] != 0 { self.jit_pages[page] = self.jit_pages[page].wrapping_add(1); }
                self.code[page] = None;
            }
        }
        Ok(())
    }
    #[inline]
    pub fn physical_read(&self, addr: u64, size: usize, access: Access) -> Result<u64, Trap> {
        if let Some(off) = addr.checked_sub(RAM_BASE).filter(|off| *off <= self.ram.len() as u64) {
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
        if let Some(off) = addr.checked_sub(RAM_BASE).filter(|off| *off <= self.ram.len() as u64) {
            if let Some(bytes) = self
                .ram
                .get_mut(off as usize..(off as usize).saturating_add(size))
            {
                if !matches!(size, 1 | 2 | 4 | 8) { return Err(Access::Write.fault(addr)); }
                bytes.copy_from_slice(&value.to_le_bytes()[..size]);
                let first = off as usize / 4096;
                let last = (off as usize + size - 1) / 4096;
                if self.jit_code[first] != 0 { self.jit_pages[first] = self.jit_pages[first].wrapping_add(1); }
                if last != first && self.jit_code[last] != 0 { self.jit_pages[last] = self.jit_pages[last].wrapping_add(1); }
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
    // Cache is physically indexed. Every RAM writer, including virtqueue DMA,
    // goes through physical_write/load_image and invalidates the affected page.
    pub fn decoded(&mut self, pa: u64) -> Option<Decoded> {
        let off = pa.checked_sub(RAM_BASE).filter(|off| *off < self.ram.len() as u64)? as usize;
        if off & 1 != 0 || off.checked_add(4)? > self.ram.len() || off & 4095 == 4094 { return None; }
        let page = off / 4096;
        let slot = (off & 4095) / 2;
        if let Some(cache) = &self.code[page] {
            if cache[slot].len != 0 { return Some(cache[slot]); }
        }
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
        let mut table = (satp & ((1 << 44) - 1)) << 12;
        for level in (0..=2).rev() {
            let pte_addr = table + ((va >> (12 + 9 * level)) & 511) * 8;
            self.pmp_check(pte_addr, 8, Access::Read, Mode::S).map_err(|_| access.fault(va))?;
            let mut pte = self
                .physical_read(pte_addr, 8, Access::Read)
                .map_err(|_| access.fault(va))?;
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
                self.physical_write(pte_addr, 8, pte)
                    .map_err(|_| access.fault(va))?;
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
