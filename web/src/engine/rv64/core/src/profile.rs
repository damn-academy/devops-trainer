//! Observer-only Sv39 reads: never fault pages in, set A/D, or touch MMIO/TLB.
use crate::{Memory, RAM_BASE};

fn resident_with<const N: usize>(memory: &Memory, pa: u64, shared: &impl Fn(u32) -> u64) -> Option<[u8; N]> {
    let offset = usize::try_from(pa.checked_sub(RAM_BASE)?).ok()?;
    let end = offset.checked_add(N)?;
    if end > memory.ram_size() || N == 0 { return None; }
    if (offset / 262144..=(end - 1) / 262144)
        .any(|i| memory.lazy_ram.get(i).copied().unwrap_or(false)) { return None; }
    if memory.shared_bytes != 0 {
        // Shared RAM is eagerly allocated. Only aligned atomic loads, never the
        // guest physical_read path (which can hydrate pages or dispatch MMIO).
        if offset & 7 != 0 || N % 8 != 0 { return None; }
        let mut bytes = [0; N];
        for (i, chunk) in bytes.chunks_exact_mut(8).enumerate() {
            chunk.copy_from_slice(&shared(u32::try_from(offset + i * 8).ok()?).to_le_bytes());
        }
        Some(bytes)
    } else {
        memory.ram.get(offset..end)?.try_into().ok()
    }
}

fn resident<const N: usize>(memory: &Memory, pa: u64) -> Option<[u8; N]> {
    resident_with(memory, pa, &|offset| {
        #[cfg(target_arch = "wasm32")]
        { crate::wasm::shared_access(0, offset, 8, 0) }
        #[cfg(not(target_arch = "wasm32"))]
        { let _ = offset; unreachable!("external shared RAM requires wasm") }
    })
}

fn mapped<const N: usize>(satp: u64, address: u64, user: bool,
    read: impl Fn(u64) -> Option<[u8; 8]>, data: impl Fn(u64) -> Option<[u8; N]>) -> Option<[u8; N]> {
    if satp >> 60 != 8 || address & 4095 > 4096 - N as u64 { return None; }
    let mut table = (satp & ((1 << 44) - 1)) << 12;
    let mut path = [(0, 0); 3];
    for (depth, level) in (0..3).rev().enumerate() {
        let at = table + ((address >> (12 + level * 9)) & 511) * 8;
        let pte = u64::from_le_bytes(read(at)?);
        path[depth] = (at, pte);
        if pte & 1 == 0 || pte & 6 == 4 || pte >> 54 != 0 { return None; }
        let ppn = (pte >> 10) & ((1 << 44) - 1);
        if pte & 10 != 0 {
            let mask = (1u64 << (12 + level * 9)) - 1;
            if pte & 2 == 0 || (pte & 16 != 0) != user || (ppn << 12) & mask != 0 { return None; }
            let pa = (ppn << 12) | (address & mask);
            let bytes = data(pa)?;
            // Best-effort observer, not an atomic address-space snapshot. Reject
            // observed changes, including a torn multiword comm, without retrying.
            if data(pa)? != bytes { return None; }
            for &(at, pte) in &path[..=depth] {
                if u64::from_le_bytes(read(at)?) != pte { return None; }
            }
            return Some(bytes);
        }
        // U/A/D are reserved on non-leaf Sv39 PTEs.
        if pte & 0xd0 != 0 { return None; }
        table = ppn << 12;
    }
    None
}

pub(crate) fn task_comm(memory: &Memory, satp: u64, address: u64) -> Option<[u64; 2]> {
    if address >> 38 != (1u64 << 26) - 1 { return None; }
    let bytes: [u8; 16] = mapped(satp, address, false, |pa| resident(memory, pa), |pa| resident(memory, pa))?;
    let end = bytes.iter().position(|b| *b == 0)?;
    if end == 0 || bytes[..end].iter().any(|b| !(32..127).contains(b)) { return None; }
    Some([u64::from_le_bytes(bytes[..8].try_into().ok()?), u64::from_le_bytes(bytes[8..].try_into().ok()?)])
}

/// None means unavailable; callers keep a validity bitmap rather than invented zeros.
pub(crate) fn stack_word(memory: &Memory, satp: u64, address: u64) -> Option<u64> {
    if address & 7 != 0 || address >> 38 != 0 { return None; }
    Some(u64::from_le_bytes(mapped(satp, address, true, |pa| resident(memory, pa), |pa| resident(memory, pa))?))
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

#[cfg(test)]
mod shared_tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn shared_and_private_observers_validate_mappings_without_side_effects() {
        for shared in [false, true] {
            let mut m = Memory::new(1024 * 1024);
            let mut external = vec![0u8; m.ram.len()];
            m.shared_bytes = if shared { external.len() } else { 0 };
            m.page_loader = Some(|_, _| panic!("observer hydrated RAM"));
            let satp = (8 << 60) | (RAM_BASE >> 12);
            for user in [false, true] {
                let va = if user { 4096 } else { 0xffff_ffff_8000_1000 };
                let root = ((va >> 30) & 511) as usize * 8;
                for flags in [0, 1, 5, 9, 3, 0x13, 0x43, 0x53, 0x83, 0x93] {
                    let pte = ((RAM_BASE >> 12) << 10) | flags;
                    let backing = if shared { &mut external } else { &mut m.ram };
                    backing[root..root+8].copy_from_slice(&pte.to_le_bytes());
                    backing[4096..4112].copy_from_slice(b"kubectl\0abcdefgh");
                    let before = backing.clone();
                    let loads = Cell::new(0);
                    let load = |off: u32| {
                        loads.set(loads.get()+1);
                        u64::from_le_bytes(external[off as usize..off as usize+8].try_into().unwrap())
                    };
                    let result: Option<[u8; 16]> = mapped(satp, va, user,
                        |pa| resident_with(&m, pa, &load), |pa| resident_with(&m, pa, &load));
                    assert_eq!(result.is_some(), flags & 3 == 3 && (flags & 16 != 0) == user);
                    if let Some(bytes) = result { assert_eq!(&bytes, b"kubectl\0abcdefgh"); }
                    assert_eq!(if shared { &external } else { &m.ram }, &before);
                    assert_eq!(loads.get() > 0, shared);
                }
            }
            let forbidden = |_: u32| -> u64 { panic!("observer touched unavailable memory/MMIO") };
            for pa in [0x1000_0000, RAM_BASE - 1, RAM_BASE + m.ram_size() as u64 - 8, u64::MAX] {
                assert!(resident_with::<16>(&m, pa, &forbidden).is_none());
            }
            m.lazy_ram = vec![false, true, false, false];
            assert!(resident_with::<16>(&m, RAM_BASE + 262136, &forbidden).is_none());
            m.lazy_ram = vec![true; 4];
            assert!(resident_with::<8>(&m, RAM_BASE, &forbidden).is_none());
            assert!(m.lazy_ram.iter().all(|v| *v));
        }
    }

    #[test]
    fn rejects_cross_page_reserved_misaligned_and_changing_mappings() {
        let satp = (8 << 60) | (RAM_BASE >> 12);
        let good = ((RAM_BASE >> 12) << 10) | 0x13;
        for pte in [0, 5, good | (1 << 54), good | (1 << 10), 0x11] {
            assert!(mapped::<8>(satp, 4096, true, |_| Some(pte.to_le_bytes()), |_| Some([42; 8])).is_none());
        }
        assert!(mapped::<16>(satp, 4090, true, |_| panic!("cross-page walk"), |_| panic!("cross-page read")).is_none());
        let reads = Cell::new(0);
        assert!(mapped::<8>(satp, 4096, true, |_| {
            reads.set(reads.get()+1);
            Some(if reads.get() == 1 { good } else { 0u64 }.to_le_bytes())
        }, |_| Some([42; 8])).is_none());
        let reads = Cell::new(0);
        assert!(mapped::<16>(satp, 4096, true, |_| Some(good.to_le_bytes()), |_| {
            reads.set(reads.get()+1); Some([reads.get(); 16])
        }).is_none());
    }

    #[test]
    fn rejects_lazy_data_and_nonresident_page_tables() {
        let mut m = Memory::new(1024 * 1024);
        let satp = (8 << 60) | (RAM_BASE >> 12);
        m.ram[..8].copy_from_slice(&(((RAM_BASE >> 12) << 10) | 0x13u64).to_le_bytes());
        m.lazy_ram = vec![false, true, false, false];
        assert!(stack_word(&m, satp, 262144).is_none());
        assert!(stack_word(&m, (8 << 60) | (0x1000_0000 >> 12), 4096).is_none());
        assert!(task_comm(&m, satp, 0xffff_ffff_8000_1ff8).is_none());
    }
}

#[cfg(test)]
mod walk_tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn shared_three_level_walk_rechecks_every_pte_and_rejects_missing_pages() {
        let mut m = Memory::new(0);
        m.shared_bytes = 1024 * 1024;
        let mut ram = vec![0u8; m.shared_bytes];
        let satp = (8 << 60) | (RAM_BASE >> 12);
        let va = 4096;
        for (off, pa, flags) in [(0, RAM_BASE + 4096, 1u64), (4096, RAM_BASE + 8192, 1),
            (8192 + 8, RAM_BASE + 12288, 0x13)] {
            ram[off..off+8].copy_from_slice(&((pa >> 12) << 10 | flags).to_le_bytes());
        }
        ram[12288..12296].copy_from_slice(&42u64.to_le_bytes());
        let before = ram.clone();
        for changed in [None, Some(0), Some(4096), Some(8200)] {
            let loads = Cell::new(0);
            let load = |offset: u32| {
                loads.set(loads.get() + 1);
                if loads.get() > 5 && changed == Some(offset) { return 0; }
                u64::from_le_bytes(ram[offset as usize..offset as usize+8].try_into().unwrap())
            };
            let value = mapped::<8>(satp, va, true,
                |pa| resident_with(&m, pa, &load), |pa| resident_with(&m, pa, &load));
            assert_eq!(value.map(u64::from_le_bytes), if changed.is_none() { Some(42) } else { None });
        }
        assert_eq!(ram, before);
        // Invalid next table points into MMIO: the shared callback must not see it.
        ram[..8].copy_from_slice(&((0x1000_0000u64 >> 12) << 10 | 1).to_le_bytes());
        let load = |offset: u32| {
            assert_eq!(offset, 0);
            u64::from_le_bytes(ram[..8].try_into().unwrap())
        };
        assert!(mapped::<8>(satp, va, true,
            |pa| resident_with(&m, pa, &load), |pa| resident_with(&m, pa, &load)).is_none());
    }
}
