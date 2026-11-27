//! Zba, Zbb and Zbs integer operations. None means an illegal encoding.
pub fn register(i: u32, a: u64, b: u64) -> Option<u64> {
    let w = i & 127 == 0x3b;
    let f = (i >> 12) & 7;
    let t = i >> 25;
    let sh = (b & if w { 31 } else { 63 }) as u32;
    let v = match (t, f) {
        (0x10, 2 | 4 | 6) => {
            let a = if w { a as u32 as u64 } else { a };
            a.wrapping_shl(f / 2).wrapping_add(b)
        }
        (0x04, 0) if w => (a as u32 as u64).wrapping_add(b),
        (0x20, 4) if !w => !(a ^ b),
        (0x20, 6) if !w => a | !b,
        (0x20, 7) if !w => a & !b,
        (0x05, 4) if !w => {
            if (a as i64) < (b as i64) {
                a
            } else {
                b
            }
        }
        (0x05, 5) if !w => a.min(b),
        (0x05, 6) if !w => {
            if (a as i64) > (b as i64) {
                a
            } else {
                b
            }
        }
        (0x05, 7) if !w => a.max(b),
        (0x30, 1) => {
            if w {
                (a as u32).rotate_left(sh) as i32 as i64 as u64
            } else {
                a.rotate_left(sh)
            }
        }
        (0x30, 5) => {
            if w {
                (a as u32).rotate_right(sh) as i32 as i64 as u64
            } else {
                a.rotate_right(sh)
            }
        }
        (0x04, 4) if w && i >> 20 & 31 == 0 => a & 0xffff,
        (0x14, 1) if !w => a | (1 << sh),
        (0x24, 1) if !w => a & !(1 << sh),
        (0x34, 1) if !w => a ^ (1 << sh),
        (0x24, 5) if !w => (a >> sh) & 1,
        _ => return None,
    };
    Some(v)
}
pub fn immediate(i: u32, a: u64) -> Option<u64> {
    let w = i & 127 == 0x1b;
    let f = (i >> 12) & 7;
    let imm = i >> 20;
    let sh = imm & 63;
    Some(match (f, imm) {
        (1, 0x600) => {
            if w {
                (a as u32).leading_zeros() as u64
            } else {
                a.leading_zeros() as u64
            }
        }
        (1, 0x601) => {
            if w {
                (a as u32).trailing_zeros() as u64
            } else {
                a.trailing_zeros() as u64
            }
        }
        (1, 0x602) => {
            if w {
                (a as u32).count_ones() as u64
            } else {
                a.count_ones() as u64
            }
        }
        (1, 0x604) if !w => a as i8 as i64 as u64,
        (1, 0x605) if !w => a as i16 as i64 as u64,
        (5, 0x287) if !w => {
            let mut v = 0;
            for n in 0..8 {
                if (a >> (n * 8)) & 255 != 0 {
                    v |= 255 << (n * 8);
                }
            }
            v
        }
        (5, 0x6b8) if !w => a.swap_bytes(),
        (5, _) if imm >> 6 == 0x18 && (!w || sh < 32) => {
            if w {
                (a as u32).rotate_right(sh) as i32 as i64 as u64
            } else {
                a.rotate_right(sh)
            }
        }
        (1, _) if w && imm >> 6 == 2 => (a as u32 as u64) << sh,
        (1, _) if !w && imm >> 6 == 10 => a | (1 << sh),
        (1, _) if !w && imm >> 6 == 18 => a & !(1 << sh),
        (1, _) if !w && imm >> 6 == 26 => a ^ (1 << sh),
        (5, _) if !w && imm >> 6 == 18 => (a >> sh) & 1,
        _ => return None,
    })
}
