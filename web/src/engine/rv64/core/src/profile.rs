//! Observer-only Sv39 read: never faults pages in, sets A/D, or touches MMIO/TLB.
use crate::{Memory, RAM_BASE};

fn resident(memory: &Memory, pa: u64, size: usize) -> Option<&[u8]> {
    let offset = usize::try_from(pa.checked_sub(RAM_BASE)?).ok()?;
    let end = offset.checked_add(size)?;
    let bytes = memory.ram.get(offset..end)?;
    if size != 0 && (offset / 262144..=(end - 1) / 262144)
        .any(|i| memory.lazy_ram.get(i).copied().unwrap_or(false)) { return None; }
    Some(bytes)
}

pub(crate) fn task_comm(memory: &Memory, satp: u64, address: u64) -> Option<[u64; 2]> {
    if satp >> 60 != 8 || address >> 38 != (1u64 << 26) - 1 { return None; }
    let mut table = (satp & ((1 << 44) - 1)) << 12;
    for level in (0..3).rev() {
        let pte = u64::from_le_bytes(resident(memory, table + ((address >> (12 + level * 9)) & 511) * 8, 8)?.try_into().ok()?);
        if pte & 1 == 0 || pte & 6 == 4 { return None; }
        let ppn = (pte >> 10) & ((1 << 44) - 1);
        if pte & 10 != 0 {
            let mask = (1u64 << (12 + level * 9)) - 1;
            if (ppn << 12) & mask != 0 || address & 4095 > 4080 { return None; }
            let bytes = resident(memory, (ppn << 12) | (address & mask), 16)?;
            let end = bytes.iter().position(|b| *b == 0)?;
            if end == 0 || bytes[..end].iter().any(|b| !(32..127).contains(b)) { return None; }
            return Some([u64::from_le_bytes(bytes[..8].try_into().ok()?), u64::from_le_bytes(bytes[8..].try_into().ok()?)]);
        }
        table = ppn << 12;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resident_observer_does_not_hydrate_or_set_accessed() {
        let mut m = Memory::new(1024 * 1024);
        let va = 0xffff_ffff_8000_1000u64;
        let root = ((va >> 30) & 511) as usize * 8;
        let pte = ((RAM_BASE >> 12) << 10) | 3; // 1 GiB leaf, A clear
        m.ram[root..root+8].copy_from_slice(&pte.to_le_bytes());
        m.ram[4096..4104].copy_from_slice(b"kubectl\0");
        let satp = (8 << 60) | (RAM_BASE >> 12);
        assert_eq!(task_comm(&m, satp, va).unwrap()[0], u64::from_le_bytes(*b"kubectl\0"));
        assert_eq!(&m.ram[root..root+8], &pte.to_le_bytes());
        m.lazy_ram = vec![true; 4];
        assert!(task_comm(&m, satp, va).is_none());
        assert!(m.lazy_ram.iter().all(|v| *v));
        assert!(task_comm(&m, satp, 0x1000).is_none());
    }
}

/// Sample a resident user stack without changing PTE A/D, TLB, lazy pages or MMIO.
/// None means unavailable; callers retain a validity bitmap rather than inventing zeros.
pub(crate) fn stack_word(memory: &Memory, satp: u64, address: u64) -> Option<u64> {
    if satp >> 60 != 8 || address & 7 != 0 || address >> 38 != 0 { return None; }
    let mut table = (satp & ((1 << 44) - 1)) << 12;
    for level in (0..3).rev() {
        let pte = u64::from_le_bytes(resident(memory, table + ((address >> (12 + level * 9)) & 511) * 8, 8)?.try_into().ok()?);
        if pte & 1 == 0 || pte & 6 == 4 || pte >> 54 != 0 { return None; }
        let ppn = (pte >> 10) & ((1 << 44) - 1);
        if pte & 10 != 0 {
            let mask = (1u64 << (12 + level * 9)) - 1;
            if pte & 18 != 18 || (ppn << 12) & mask != 0 { return None; }
            return Some(u64::from_le_bytes(resident(memory, (ppn << 12) | (address & mask), 8)?.try_into().ok()?));
        }
        table = ppn << 12;
    }
    None
}

#[cfg(test)]
mod stack_tests {
    use super::*;
    #[test]
    fn stack_observer_requires_user_readable_resident_mapping() {
        let mut m = Memory::new(1024 * 1024);
        let pte = ((RAM_BASE >> 12) << 10) | 0x13;
        m.ram[..8].copy_from_slice(&pte.to_le_bytes());
        m.ram[4096..4104].copy_from_slice(&42u64.to_le_bytes());
        let satp = (8 << 60) | (RAM_BASE >> 12);
        assert_eq!(stack_word(&m, satp, 4096), Some(42));
        assert_eq!(&m.ram[..8], &pte.to_le_bytes());
        assert!(stack_word(&m, satp, 4097).is_none());
        m.ram[0] &= !16;
        assert!(stack_word(&m, satp, 4096).is_none());
        m.ram[0] |= 16; m.lazy_ram = vec![true; 4];
        assert!(stack_word(&m, satp, 4096).is_none());
        assert!(m.lazy_ram.iter().all(|v| *v));
    }
}
