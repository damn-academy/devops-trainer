//! SBI 2.0, single-hart platform. No firmware instruction stream is needed.
use crate::{Access, Cpu, Mode};
const EXTENSIONS: [u64; 17] = [
    0x10, 0x54494d45, 0x735049, 0x52464e43, 0x48534d, 0x53525354, 0x4442434e, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0x504d55,
];
impl Cpu {
    pub fn boot_supervisor(&mut self, entry: u64, dtb: u64) {
        self.memory.pmpcfg[0] = 0x1f;
        self.memory.pmpaddr[0] = (1 << 54) - 1;
        self.pc = entry;
        self.mode = Mode::S;
        self.x[10] = 0;
        self.x[11] = dtb;
        self.sbi = true;
        self.csr[0x306] = 7;
        self.csr[0x106] = 7;
        self.csr[0x303] = 0x222;
        self.csr[0x302] = 0xb1ff;
        self.csr[0x30a] = (1 << 63) | (1 << 61);
        self.memory.adue = true;
        self.csr[0x300] = (self.csr[0x300] & !(3 << 11)) | (1 << 11);
    }
    pub(crate) fn sbi_call(&mut self) {
        let ext = self.x[17];
        let fid = self.x[16];
        let a = self.x[10];
        let b = self.x[11];
        let c = self.x[12];
        let (mut error, mut value) = (0i64, 0u64);
        match (ext, fid) {
            (0, _) | (0x54494d45, 0) => {
                self.sbi_timer_calls += 1;
                self.csr[0x14d] = a;
                self.csr[0x344] &= !(1 << 5);
            }
            (1, _) => self.console.push(a as u8),
            (2, _) => {
                self.x[10] = self.input.pop_front().map(|v| v as u64).unwrap_or(u64::MAX);
                return;
            }
            (3, _) => self.csr[0x344] &= !2,
            (4..=7, _) => {
                let mask = if a == 0 { Ok(1) } else { self.memory.physical_read(a, 8, Access::Read) };
                match mask {
                    Ok(mask) if mask & 1 != 0 => { if ext == 4 { self.csr[0x344] |= 2; } else { self.memory.flush(); } }
                    Ok(_) => {}, Err(_) => error = -5,
                }
            }
            (8, _) => self.stopped = true,
            (0x504d55, 0) => value = 0,
            (0x10, 0) => value = 2 << 24,
            (0x10, 1) => value = 0x10000000, // experimental implementation ID
            (0x10, 2) => value = 1,
            (0x10, 3) => value = EXTENSIONS.contains(&a) as u64,
            (0x10, 4..=6) => {}
            (0x735049, 0) => {
                if b == u64::MAX || (b == 0 && a & 1 != 0) {
                    self.csr[0x344] |= 2;
                } else if a != 0 {
                    error = -3;
                }
            }
            (0x52464e43, 0..=2) => {
                if b == u64::MAX || (b == 0 && a & 1 != 0) {
                    self.memory.flush();
                } else if a != 0 {
                    error = -3;
                }
            }
            (0x48534d, 0) => error = if a == 0 { -6 } else { -3 },
            (0x48534d, 1) => {
                self.stopped = true;
                self.waiting = true;
            }
            (0x48534d, 2) => {
                if a == 0 {
                    value = 0
                } else {
                    error = -3
                }
            }
            (0x53525354, 0) => {
                if a <= 2 && b <= 1 {
                    self.reset_requested = a != 0;
                    self.stopped = true
                } else {
                    error = -3
                }
            }
            (0x4442434e, 2) => self.console.push(a as u8),
            (0x4442434e, 0 | 1) => {
                if c != 0 || a > 1024 * 1024 {
                    error = -5;
                } else {
                    for j in 0..a {
                        let Some(addr) = b.checked_add(j) else {
                            error = -5;
                            break;
                        };
                        if fid == 0 {
                            match self.memory.physical_read(addr, 1, Access::Read) {
                                Ok(v) => {
                                    self.console.push(v as u8);
                                    value += 1
                                }
                                Err(_) => {
                                    error = -5;
                                    break;
                                }
                            }
                        } else {
                            let Some(v) = self.input.front().copied() else {
                                break;
                            };
                            if self.memory.physical_write(addr, 1, v as u64).is_err() {
                                error = -5;
                                break;
                            }
                            self.input.pop_front();
                            value += 1;
                        }
                    }
                }
            }
            _ => error = -2,
        }
        self.x[10] = error as u64;
        self.x[11] = value;
    }
}
