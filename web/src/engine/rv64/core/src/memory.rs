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
struct Tlb {
    tag: u64,
    pa: u64,
    context: u64,
    satp: u64,
    valid: bool,
}
const EMPTY: Tlb = Tlb {
    tag: 0,
    pa: 0,
    context: 0,
    satp: 0,
    valid: false,
};
pub struct Memory {
    pub ram: Vec<u8>,
    pub devices: crate::devices::Devices,
    tlb: [[Tlb; 256]; 3],
    pub time: u64,
    pub mtimecmp: u64,
    pub msip: bool,
}
impl Memory {
    pub fn new(bytes: usize) -> Self {
        Self {
            devices: Default::default(),
            ram: vec![0; bytes],
            tlb: [[EMPTY; 256]; 3],
            time: 0,
            mtimecmp: u64::MAX,
            msip: false,
        }
    }
    pub fn flush(&mut self) {
        self.tlb = [[EMPTY; 256]; 3];
    }
    pub fn load_image(&mut self, addr: u64, data: &[u8]) -> Result<(), Trap> {
        let start = addr
            .checked_sub(RAM_BASE)
            .ok_or(Access::Write.fault(addr))? as usize;
        let end = start
            .checked_add(data.len())
            .ok_or(Access::Write.fault(addr))?;
        let dest = self
            .ram
            .get_mut(start..end)
            .ok_or(Access::Write.fault(addr))?;
        dest.copy_from_slice(data);
        Ok(())
    }
    pub fn physical_read(&self, addr: u64, size: usize, access: Access) -> Result<u64, Trap> {
        if let Some(off) = addr.checked_sub(RAM_BASE) {
            if let Some(bytes) = self
                .ram
                .get(off as usize..(off as usize).saturating_add(size))
            {
                return Ok(bytes
                    .iter()
                    .enumerate()
                    .fold(0, |v, (i, b)| v | ((*b as u64) << (8 * i))));
            }
        }
        match (addr, size) {
            (0x0200_0000, 4) => Ok(self.msip as u64),
            (0x0200_4000, 8) => Ok(self.mtimecmp),
            (0x0200_bff8, 8) => Ok(self.time),
            _ => Err(access.fault(addr)),
        }
    }
    pub fn physical_write(&mut self, addr: u64, size: usize, value: u64) -> Result<(), Trap> {
        if let Some(off) = addr.checked_sub(RAM_BASE) {
            if let Some(bytes) = self
                .ram
                .get_mut(off as usize..(off as usize).saturating_add(size))
            {
                for (i, b) in bytes.iter_mut().enumerate() {
                    *b = (value >> (8 * i)) as u8;
                }
                return Ok(());
            }
        }
        match (addr, size) {
            (0x0200_0000, 4) => self.msip = value & 1 != 0,
            (0x0200_4000, 8) => self.mtimecmp = value,
            _ => return Err(Access::Write.fault(addr)),
        }
        Ok(())
    }
    pub fn translate(
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
        let mut table = (satp & ((1 << 44) - 1)) << 12;
        for level in (0..=2).rev() {
            let pte_addr = table + ((va >> (12 + 9 * level)) & 511) * 8;
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
                pte |= ad;
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
            };
            return Ok(pa);
        }
        Err(fault)
    }
}
