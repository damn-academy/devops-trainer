//! RV64C expansion into the regular decoder (including floating load/store encodings).
fn imm(op: u32, rd: u32, f: u32, rs: u32, v: u32) -> u32 {
    (v & 4095) << 20 | rs << 15 | f << 12 | rd << 7 | op
}
fn reg(op: u32, rd: u32, f: u32, a: u32, b: u32, t: u32) -> u32 {
    t << 25 | b << 20 | a << 15 | f << 12 | rd << 7 | op
}
fn store(op: u32, f: u32, a: u32, b: u32, v: u32) -> u32 {
    (v >> 5) << 25 | b << 20 | a << 15 | f << 12 | (v & 31) << 7 | op
}
fn sx(v: u32, b: u32) -> u32 {
    ((v << (32 - b)) as i32 >> (32 - b)) as u32
}
pub fn expand(c: u16) -> Option<u32> {
    let c = c as u32;
    let rd = (c >> 7) & 31;
    let rs2 = (c >> 2) & 31;
    let a = 8 + ((c >> 7) & 7);
    let b = 8 + ((c >> 2) & 7);
    let f = c >> 13;
    let ci = sx(((c >> 12) & 1) << 5 | ((c >> 2) & 31), 6);
    Some(match (c & 3, f) {
        (0, 0) => {
            let v = ((c >> 7) & 15) << 6
                | ((c >> 11) & 3) << 4
                | ((c >> 5) & 1) << 3
                | ((c >> 6) & 1) << 2;
            if v == 0 {
                return None;
            }
            imm(0x13, b, 0, 2, v)
        }
        (0, 1 | 2 | 3) => {
            let wide = f != 2;
            let v = if wide {
                ((c >> 5) & 3) << 6 | ((c >> 10) & 7) << 3
            } else {
                ((c >> 5) & 1) << 6 | ((c >> 10) & 7) << 3 | ((c >> 6) & 1) << 2
            };
            imm(
                if f == 1 { 7 } else { 3 },
                b,
                if wide { 3 } else { 2 },
                a,
                v,
            )
        }
        (0, 5 | 6 | 7) => {
            let wide = f != 6;
            let v = if wide {
                ((c >> 5) & 3) << 6 | ((c >> 10) & 7) << 3
            } else {
                ((c >> 5) & 1) << 6 | ((c >> 10) & 7) << 3 | ((c >> 6) & 1) << 2
            };
            store(
                if f == 5 { 0x27 } else { 0x23 },
                if wide { 3 } else { 2 },
                a,
                b,
                v,
            )
        }
        (1, 0) => imm(0x13, rd, 0, rd, ci),
        (1, 1) if rd != 0 => imm(0x1b, rd, 0, rd, ci),
        (1, 2) => imm(0x13, rd, 0, 0, ci),
        (1, 3) if rd == 2 => {
            let v = sx(
                ((c >> 12) & 1) << 9
                    | ((c >> 3) & 3) << 7
                    | ((c >> 5) & 1) << 6
                    | ((c >> 2) & 1) << 5
                    | ((c >> 6) & 1) << 4,
                10,
            );
            if v == 0 {
                return None;
            }
            imm(0x13, 2, 0, 2, v)
        }
        (1, 3) if ci != 0 => (ci << 12) | rd << 7 | 0x37,
        (1, 4) => match (c >> 10) & 3 {
            0 => imm(0x13, a, 5, a, ci & 63),
            1 => imm(0x13, a, 5, a, 0x400 | (ci & 63)),
            2 => imm(0x13, a, 7, a, ci),
            _ => {
                let sub = (c >> 5) & 3;
                let w = c & (1 << 12) != 0;
                if w && sub > 1 {
                    return None;
                }
                reg(
                    if w { 0x3b } else { 0x33 },
                    a,
                    if w { 0 } else { [0, 4, 6, 7][sub as usize] },
                    a,
                    b,
                    if sub == 0 { 32 } else { 0 },
                )
            }
        },
        (1, 5) => {
            let v = sx(
                ((c >> 12) & 1) << 11
                    | ((c >> 8) & 1) << 10
                    | ((c >> 9) & 3) << 8
                    | ((c >> 6) & 1) << 7
                    | ((c >> 7) & 1) << 6
                    | ((c >> 2) & 1) << 5
                    | ((c >> 11) & 1) << 4
                    | ((c >> 3) & 7) << 1,
                12,
            );
            ((v >> 20) & 1) << 31
                | ((v >> 1) & 1023) << 21
                | ((v >> 11) & 1) << 20
                | ((v >> 12) & 255) << 12
                | 0x6f
        }
        (1, 6 | 7) => {
            let v = sx(
                ((c >> 12) & 1) << 8
                    | ((c >> 5) & 3) << 6
                    | ((c >> 2) & 1) << 5
                    | ((c >> 10) & 3) << 3
                    | ((c >> 3) & 3) << 1,
                9,
            );
            ((v >> 12) & 1) << 31
                | ((v >> 5) & 63) << 25
                | a << 15
                | (f - 6) << 12
                | ((v >> 1) & 15) << 8
                | ((v >> 11) & 1) << 7
                | 0x63
        }
        (2, 0) => imm(0x13, rd, 1, rd, ci & 63),
        (2, 1 | 2 | 3) if rd != 0 || f == 1 => {
            let wide = f != 2;
            let v = if wide {
                ((c >> 2) & 7) << 6 | ((c >> 12) & 1) << 5 | ((c >> 5) & 3) << 3
            } else {
                ((c >> 2) & 3) << 6 | ((c >> 12) & 1) << 5 | ((c >> 4) & 7) << 2
            };
            imm(
                if f == 1 { 7 } else { 3 },
                rd,
                if wide { 3 } else { 2 },
                2,
                v,
            )
        }
        (2, 4) => match (c & (1 << 12) != 0, rs2, rd) {
            (false, 0, 0) => return None,
            (false, 0, _) => imm(0x67, 0, 0, rd, 0),
            (false, _, _) => reg(0x33, rd, 0, 0, rs2, 0),
            (true, 0, 0) => 0x00100073,
            (true, 0, _) => imm(0x67, 1, 0, rd, 0),
            (true, _, _) => reg(0x33, rd, 0, rd, rs2, 0),
        },
        (2, 5 | 6 | 7) => {
            let wide = f != 6;
            let v = if wide {
                ((c >> 7) & 7) << 6 | ((c >> 10) & 7) << 3
            } else {
                ((c >> 7) & 3) << 6 | ((c >> 9) & 15) << 2
            };
            store(
                if f == 5 { 0x27 } else { 0x23 },
                if wide { 3 } else { 2 },
                2,
                rs2,
                v,
            )
        }
        _ => return None,
    })
}
