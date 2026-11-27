//! Exact, host-independent F/D arithmetic. NaN payloads canonicalize at arithmetic boundaries.
use crate::{Cpu, Trap};
use rustc_apfloat::{
    ieee::{Double, Single},
    Float, FloatConvert, Round, Status, StatusAnd,
};
fn flags(s: Status) -> u64 {
    (s.contains(Status::INVALID_OP) as u64) * 16
        | (s.contains(Status::DIV_BY_ZERO) as u64) * 8
        | (s.contains(Status::OVERFLOW) as u64) * 4
        | (s.contains(Status::UNDERFLOW) as u64) * 2
        | s.contains(Status::INEXACT) as u64
}
fn bits<F: Float>(r: StatusAnd<F>) -> (u64, u64) {
    (
        if r.value.is_nan() {
            F::NAN.to_bits()
        } else {
            r.value.to_bits()
        } as u64,
        flags(r.status),
    )
}
fn classify<F: Float>(a: F) -> u64 {
    let n = a.is_negative();
    1 << if a.is_nan() {
        if a.is_signaling() {
            8
        } else {
            9
        }
    } else if a.is_infinite() {
        if n {
            0
        } else {
            7
        }
    } else if a.is_zero() {
        if n {
            3
        } else {
            4
        }
    } else if a.is_denormal() {
        if n {
            2
        } else {
            5
        }
    } else if n {
        1
    } else {
        6
    }
}
fn calc<F: Float>(
    op: u32,
    rm: u32,
    a: F,
    b: F,
    c: F,
    round: Round,
    x: u64,
    rs2: u32,
) -> Option<(u64, u64, bool)> {
    let mut integer = false;
    let (value, fl) = match op {
        0 => bits(a.add_r(b, round)),
        4 => bits(a.sub_r(b, round)),
        8 => bits(a.mul_r(b, round)),
        12 => bits(a.div_r(b, round)),
        0x100 => bits(a.mul_add_r(b, c, round)),
        0x104 => bits(a.mul_add_r(b, -c, round)),
        0x108 => bits((-a).mul_add_r(b, c, round)),
        0x10c => bits((-a).mul_add_r(b, -c, round)),
        0x10 if rm < 3 => {
            let sign = 1u128 << (F::BITS - 1);
            let aa = a.to_bits();
            let bb = b.to_bits();
            (
                ((aa & !sign)
                    | match rm {
                        0 => bb & sign,
                        1 => (!bb) & sign,
                        _ => (aa ^ bb) & sign,
                    }) as u64,
                0,
            )
        }
        0x14 if rm < 2 => {
            let invalid = if a.is_signaling() || b.is_signaling() {
                16
            } else {
                0
            };
            let v = if a.is_nan() && b.is_nan() {
                F::NAN
            } else if a.is_nan() {
                b
            } else if b.is_nan() {
                a
            } else if a.is_zero() && b.is_zero() {
                if rm == 0 {
                    if a.is_negative() {
                        a
                    } else {
                        b
                    }
                } else if a.is_negative() {
                    b
                } else {
                    a
                }
            } else if (rm == 0 && a < b) || (rm == 1 && a > b) {
                a
            } else {
                b
            };
            (v.to_bits() as u64, invalid)
        }
        0x50 if rm < 3 => {
            integer = true;
            let invalid = if a.is_signaling()
                || b.is_signaling()
                || (rm != 2 && (a.is_nan() || b.is_nan()))
            {
                16
            } else {
                0
            };
            (
                (match rm {
                    0 => a <= b,
                    1 => a < b,
                    _ => a == b,
                }) as u64,
                invalid,
            )
        }
        0x60 if rs2 < 4 => {
            integer = true;
            let width = if rs2 < 2 { 32 } else { 64 };
            let mut exact = false;
            let (mut v, s) = if rs2 & 1 == 0 {
                let r = a.to_i128_r(width, round, &mut exact);
                (r.value as u64, r.status)
            } else {
                let r = a.to_u128_r(width, round, &mut exact);
                (r.value as u64, r.status)
            };
            // RISC-V saturates NaN to the largest destination value.
            if a.is_nan() {
                v = if rs2 & 1 == 0 {
                    (1u64 << (width - 1)) - 1
                } else if width == 64 {
                    u64::MAX
                } else {
                    u32::MAX as u64
                };
            }
            if width == 32 {
                v = v as u32 as i32 as i64 as u64;
            }
            (v, flags(s))
        }
        0x68 if rs2 < 4 => {
            if rs2 & 1 == 0 {
                bits(F::from_i128_r(
                    if rs2 == 0 {
                        x as i32 as i128
                    } else {
                        x as i64 as i128
                    },
                    round,
                ))
            } else {
                bits(F::from_u128_r(
                    if rs2 == 1 {
                        x as u32 as u128
                    } else {
                        x as u128
                    },
                    round,
                ))
            }
        }
        0x70 if rs2 == 0 && rm == 1 => {
            integer = true;
            (classify(a), 0)
        }
        _ => return None,
    };
    Some((value, fl, integer))
}
impl Cpu {
    fn fp_read(&self, n: usize, single: bool) -> u64 {
        if single {
            if self.f[n] >> 32 == u32::MAX as u64 {
                self.f[n] as u32 as u64
            } else {
                0x7fc00000
            }
        } else {
            self.f[n]
        }
    }
    pub(crate) fn fp(&mut self, i: u32) -> Result<(), Trap> {
        let err = Trap {
            cause: 2,
            value: i as u64,
        };
        if self.csr[0x300] & (3 << 13) == 0 {
            return Err(err);
        }
        let rd = ((i >> 7) & 31) as usize;
        let rs1 = ((i >> 15) & 31) as usize;
        let rs2 = ((i >> 20) & 31) as usize;
        let opcode = i & 127;
        let single = (i >> 25) & 1 == 0;
        let rm = (i >> 12) & 7;
        let mode = if rm == 7 {
            (self.csr[3] >> 5) & 7
        } else {
            rm as u64
        };
        let top = i >> 25;
        let op = top & !1;
        let uses_round = matches!(op, 0 | 4 | 8 | 12 | 0x20 | 0x2c | 0x60 | 0x68) || opcode != 0x53;
        let round = match mode {
            0 => Round::NearestTiesToEven,
            1 => Round::TowardZero,
            2 => Round::TowardNegative,
            3 => Round::TowardPositive,
            4 => Round::NearestTiesToAway,
            _ if !uses_round => Round::NearestTiesToEven,
            _ => return Err(err),
        };
        let a = self.fp_read(rs1, single);
        let b = self.fp_read(rs2, single);
        let c = self.fp_read((i >> 27) as usize, single);
        let (v, fl, int) = if opcode != 0x53 {
            if (i >> 25) & 3 > 1 {
                return Err(err);
            }
            let op = 0x100 + (opcode - 0x43);
            if single {
                calc(
                    op,
                    rm,
                    Single::from_bits(a as u128),
                    Single::from_bits(b as u128),
                    Single::from_bits(c as u128),
                    round,
                    0,
                    0,
                )
            } else {
                calc(
                    op,
                    rm,
                    Double::from_bits(a as u128),
                    Double::from_bits(b as u128),
                    Double::from_bits(c as u128),
                    round,
                    0,
                    0,
                )
            }
            .ok_or(err)?
        } else if op == 0x2c && rs2 == 0 {
            let (v, fl) = if single {
                let r = ieee_apsqrt::sqrt_accurate(a as u32, round).0;
                (r.value as u64, flags(r.status))
            } else {
                let r = ieee_apsqrt::sqrt_accurate(a, round).0;
                (r.value, flags(r.status))
            };
            (v, fl, false)
        } else if op == 0x20 && ((single && rs2 == 1) || (!single && rs2 == 0)) {
            let mut loses = false;
            let (v, fl) = if single {
                let r: StatusAnd<Single> =
                    Double::from_bits(self.f[rs1] as u128).convert_r(round, &mut loses);
                bits(r)
            } else {
                let r: StatusAnd<Double> =
                    Single::from_bits(self.fp_read(rs1, true) as u128).convert_r(round, &mut loses);
                bits(r)
            };
            (v, fl, false)
        } else if op == 0x70 && rm == 0 && rs2 == 0 {
            (
                if single {
                    self.f[rs1] as u32 as i32 as i64 as u64
                } else {
                    self.f[rs1]
                },
                0,
                true,
            )
        } else if op == 0x78 && rm == 0 && rs2 == 0 {
            (self.x[rs1], 0, false)
        } else if single {
            calc(
                op,
                rm,
                Single::from_bits(a as u128),
                Single::from_bits(b as u128),
                Single::ZERO,
                round,
                self.x[rs1],
                rs2 as u32,
            )
            .ok_or(err)?
        } else {
            calc(
                op,
                rm,
                Double::from_bits(a as u128),
                Double::from_bits(b as u128),
                Double::ZERO,
                round,
                self.x[rs1],
                rs2 as u32,
            )
            .ok_or(err)?
        };
        if int {
            if rd != 0 {
                self.x[rd] = v
            }
        } else {
            self.f[rd] = if single {
                0xffffffff00000000 | (v & 0xffffffff)
            } else {
                v
            };
        }
        self.csr[3] |= fl;
        self.csr[0x300] |= (3 << 13) | (1 << 63);
        Ok(())
    }
}
