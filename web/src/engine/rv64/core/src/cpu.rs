use crate::memory::{Access, Memory, RAM_BASE};
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[repr(u64)]
pub enum Mode {
    U = 0,
    S = 1,
    M = 3,
}
impl Mode {
    pub fn from_bits(v: u64) -> Self {
        match v {
            0 => Self::U,
            1 => Self::S,
            _ => Self::M,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Trap {
    pub cause: u64,
    pub value: u64,
}
fn sext(v: u64, b: u32) -> u64 {
    ((v << (64 - b)) as i64 >> (64 - b)) as u64
}
fn word(v: u64) -> u64 {
    v as u32 as i32 as i64 as u64
}
const SSTATUS: u64 =
    (1 << 1) | (1 << 5) | (1 << 8) | (3 << 13) | (1 << 18) | (1 << 19) | (3 << 32) | (1 << 63);
#[derive(serde::Serialize, serde::Deserialize)]
pub struct Cpu {
    #[cfg(not(target_arch = "wasm32"))]
    #[serde(skip)]
    pub trace_enabled: bool,
    #[cfg(not(target_arch = "wasm32"))]
    #[serde(skip)]
    pub last_trace: Option<TraceEvent>,
    pub x: [u64; 32],
    pub f: [u64; 32],
    pub pc: u64,
    pub mode: Mode,
    #[serde(with = "serde_big_array::BigArray")]
    pub csr: [u64; 4096],
    pub memory: Memory,
    pub retired: u64,
    pub cycles: u64,
    pub waiting: bool,
    pub input: std::collections::VecDeque<u8>,
    pub stopped: bool,
    pub reset_requested: bool,
    pub sbi_timer_calls: u64,
    pub stimecmp_writes: u64,
    pub console: Vec<u8>,
    pub sbi: bool,
    reservation: Option<(u64, usize)>,
    wrote_instret: bool,
}
#[cfg(not(target_arch = "wasm32"))]
#[derive(Clone, Copy, Debug)]
pub enum TraceEvent { Instruction { pc: u64, raw: u32 }, Trap { pc: u64, trap: Trap, target: u64 } }
impl Cpu {
    pub fn new(bytes: usize) -> Self {
        let mut cpu = Self {
            #[cfg(not(target_arch = "wasm32"))]
            trace_enabled: false,
            #[cfg(not(target_arch = "wasm32"))]
            last_trace: None,
            x: [0; 32],
            f: [0; 32],
            pc: RAM_BASE,
            mode: Mode::M,
            csr: [0; 4096],
            memory: Memory::new(bytes),
            retired: 0,
            cycles: 0,
            waiting: false,
            input: std::collections::VecDeque::new(),
            stopped: false,
            reset_requested: false,
            sbi_timer_calls: 0,
            stimecmp_writes: 0,
            console: Vec::new(),
            sbi: false,
            reservation: None,
            wrote_instret: false,
        };
        // RV64IMAFDC, supervisor and user modes.
        cpu.csr[0x301] = (2 << 62)
            | (1 << 0)
            | (1 << 2)
            | (1 << 3)
            | (1 << 5)
            | (1 << 8)
            | (1 << 12)
            | (1 << 18)
            | (1 << 20);
        cpu.csr[0x300] = (2 << 32) | (2 << 34);
        cpu.csr[0x14d] = u64::MAX;
        cpu.csr[0x30a] = 1 << 61;
        cpu
    }
    pub fn time(&mut self, ticks: u64) {
        self.memory.time = self.memory.time.wrapping_add(ticks.saturating_sub(self.memory.host_ticks));
        self.memory.host_ticks = self.memory.host_ticks.max(ticks);
        self.refresh_timer();
    }
    fn refresh_timer(&mut self) {
        self.csr[0x344] = (self.csr[0x344] & !((1 << 7) | (1 << 3)))
            | ((self.memory.time >= self.memory.mtimecmp) as u64) << 7
            | (self.memory.msip as u64) << 3;
        if self.csr[0x30a] & (1 << 63) != 0 {
            self.csr[0x344] =
                (self.csr[0x344] & !(1 << 5)) | ((self.memory.time >= self.csr[0x14d]) as u64) << 5;
        }
    }
    fn illegal(&self, ins: u32) -> Trap {
        Trap {
            cause: 2,
            value: ins as u64,
        }
    }
    fn status(&self) -> u64 {
        let raw = self.csr[0x300] & !(1 << 63);
        raw | (((raw >> 13) & 3 == 3) as u64) << 63
    }
    pub fn read_csr(&self, n: usize) -> Result<u64, Trap> {
        let err = Trap { cause: 2, value: 0 };
        if ((n >> 8) & 3) as u64 > self.mode as u64 {
            return Err(err);
        }
        if (0xc00..=0xc02).contains(&n) && self.mode != Mode::M {
            let bit = 1 << (n - 0xc00);
            if self.csr[0x306] & bit == 0 || (self.mode == Mode::U && self.csr[0x106] & bit == 0) {
                return Err(err);
            }
        }
        if n == 0x14d
            && self.mode != Mode::M
            && (self.csr[0x30a] & (1 << 63) == 0 || self.csr[0x306] & 2 == 0)
        {
            return Err(err);
        }
        if n == 0x180 && self.mode == Mode::S && self.csr[0x300] & (1 << 20) != 0 {
            return Err(err);
        }
        if (1..=3).contains(&n) && self.csr[0x300] & (3 << 13) == 0 {
            return Err(err);
        }
        Ok(match n {
            1 => self.csr[3] & 31,
            2 => (self.csr[3] >> 5) & 7,
            3 => self.csr[3],
            0x100 => self.status() & SSTATUS,
            0x300 => self.status(),
            0x104 => self.csr[0x304] & self.csr[0x303],
            0x144 => self.csr[0x344] & self.csr[0x303],
            0xc00 | 0xb00 => self.cycles,
            0xc01 => self.memory.time,
            0xc02 | 0xb02 => self.retired,
            0xf11..=0xf15 | 0x10a => 0,
            0x3a0 | 0x3a2 => {
                let base = (n - 0x3a0) * 4;
                (0..8).fold(0, |v, i| v | ((self.memory.pmpcfg[base+i] as u64) << (i*8)))
            }
            0x3b0..=0x3bf => self.memory.pmpaddr[n - 0x3b0],
            0x105
            | 0x106
            | 0x140..=0x143
            | 0x14d
            | 0x180
            | 0x300..=0x306
            | 0x30a
            | 0x320
            | 0x340..=0x344 => self.csr[n],
            _ => return Err(err),
        })
    }
    pub fn write_csr(&mut self, n: usize, v: u64) -> Result<(), Trap> {
        self.read_csr(n)?;
        if n >> 10 == 3 {
            return Err(Trap { cause: 2, value: 0 });
        }
        match n {
            1 => {
                self.csr[3] = (self.csr[3] & !31) | (v & 31);
                self.csr[0x300] |= (3 << 13) | (1 << 63);
            }
            2 => {
                self.csr[3] = (self.csr[3] & 31) | ((v & 7) << 5);
                self.csr[0x300] |= (3 << 13) | (1 << 63);
            }
            3 => {
                self.csr[3] = v & 255;
                self.csr[0x300] |= (3 << 13) | (1 << 63);
            }
            0x100 => {
                self.csr[0x300] =
                    (self.csr[0x300] & !SSTATUS) | (v & SSTATUS & !((3 << 32) | (1 << 63))) | (2 << 32)
            }
            0x104 => self.csr[0x304] = (self.csr[0x304] & !self.csr[0x303]) | (v & self.csr[0x303]),
            0x144 => self.csr[0x344] = (self.csr[0x344] & !2) | (v & 2),
            0x344 => {
                let mask = if self.csr[0x30a] & (1 << 63) != 0 { 0x202 } else { 0x222 };
                self.csr[n] = (self.csr[n] & !mask) | (v & mask);
            }
            0x301 | 0x10a => {}
            0x3a0 | 0x3a2 => {
                let base = (n - 0x3a0) * 4;
                for i in 0..8 {
                    if self.memory.pmpcfg[base+i] & 128 == 0 {
                        let mut cfg = (v >> (i*8)) as u8 & 0x9f;
                        if cfg & 3 == 2 { cfg &= !2; }
                        self.memory.pmpcfg[base+i] = cfg;
                    }
                }
                self.memory.flush();
            }
            0x3b0..=0x3bf => {
                let i = n - 0x3b0;
                if self.memory.pmpcfg[i] & 128 == 0 && !(i < 15 && self.memory.pmpcfg[i+1] & 0x98 == 0x88) {
                    self.memory.pmpaddr[i] = v & ((1 << 54) - 1);
                    self.memory.flush();
                }
            }
            0x14d => {
                self.stimecmp_writes += 1;
                self.csr[n] = v;
                self.refresh_timer();
            }
            0x300 => {
                let mask = (1<<1)|(1<<3)|(1<<5)|(1<<7)|(1<<8)|(3<<11)|(3<<13)|(1<<17)|(1<<18)|(1<<19)|(1<<20)|(1<<21)|(1<<22);
                self.csr[n] = (v & mask) | (2 << 32) | (2 << 34);
                if (self.csr[n] >> 11) & 3 == 2 { self.csr[n] &= !(3 << 11); }
            }
            0x30a => {
                self.csr[n] = v & ((1 << 63) | (1 << 61));
                self.memory.adue = v & (1 << 61) != 0;
                self.memory.flush(); self.refresh_timer();
            }
            0x180 => {
                if v >> 60 == 0 || v >> 60 == 8 {
                    self.csr[n] = v;
                    self.memory.flush();
                }
            }
            0x141 | 0x341 => self.csr[n] = v & !1,
            0x105 | 0x305 => self.csr[n] = v & !2,
            0x302 => self.csr[n] = v & 0xb3ff,
            0x303 => self.csr[n] = v & 0x222,
            0xb00 => self.cycles = v,
            0xb02 => {
                self.retired = v;
                self.wrote_instret = true;
            }
            _ => self.csr[n] = v,
        }
        Ok(())
    }
    pub fn trap(&mut self, t: Trap) {
        #[cfg(not(target_arch = "wasm32"))]
        let fault_pc = self.pc;
        let interrupt = t.cause >> 63 != 0;
        let cause = t.cause & !(1 << 63);
        let deleg = self.csr[if interrupt { 0x303 } else { 0x302 }];
        let supervisor = self.mode != Mode::M && cause < 64 && deleg & (1 << cause) != 0;
        let status = self.csr[0x300];
        let base = if supervisor {
            self.csr[0x141] = self.pc;
            self.csr[0x142] = t.cause;
            self.csr[0x143] = t.value;
            self.csr[0x300] = (status & !((1 << 1) | (1 << 5) | (1 << 8)))
                | ((status & (1 << 1)) << 4)
                | ((self.mode == Mode::S) as u64) << 8;
            self.mode = Mode::S;
            self.csr[0x105]
        } else {
            self.csr[0x341] = self.pc;
            self.csr[0x342] = t.cause;
            self.csr[0x343] = t.value;
            self.csr[0x300] = (status & !((1 << 3) | (1 << 7) | (3 << 11)))
                | ((status & (1 << 3)) << 4)
                | ((self.mode as u64) << 11);
            self.mode = Mode::M;
            self.csr[0x305]
        };
        self.pc = (base & !3)
            + if interrupt && base & 3 == 1 {
                4 * cause
            } else {
                0
            };
        self.waiting = false;
        self.reservation = None;
        #[cfg(not(target_arch = "wasm32"))]
        if self.trace_enabled { self.last_trace = Some(TraceEvent::Trap { pc: fault_pc, trap: t, target: self.pc }); }
    }
    fn interrupt(&mut self) -> bool {
        let pending = self.csr[0x344] & self.csr[0x304];
        if pending == 0 { return false; }
        self.waiting = false;
        for i in [11, 3, 7, 9, 1, 5] {
            if pending & (1 << i) == 0 {
                continue;
            }
            let delegated = self.csr[0x303] & (1 << i) != 0;
            let enabled = if delegated {
                self.mode == Mode::U || (self.mode == Mode::S && self.csr[0x300] & 2 != 0)
            } else {
                self.mode != Mode::M || self.csr[0x300] & 8 != 0
            };
            if enabled {
                self.trap(Trap {
                    cause: (1 << 63) | i,
                    value: 0,
                });
                return true;
            }
        }
        false
    }
    pub fn load(&mut self, a: u64, n: usize, access: Access) -> Result<u64, Trap> {
        if a & (n as u64 - 1) != 0 && access != Access::Fetch {
            let mut v = 0;
            for j in 0..n {
                v |= self.load(a.wrapping_add(j as u64), 1, access)? << (8 * j);
            }
            return Ok(v);
        }
        let p = self
            .memory
            .translate_size(a, n, access, self.mode, self.csr[0x180], self.csr[0x300])?;
        if (0xc000000..0x10004000).contains(&p) && access != Access::Fetch {
            // Device-specific virtio configuration permits byte/halfword reads
            // (Linux reads the MAC with readb), unlike transport registers.
            if (0x10000000..0x10004000).contains(&p) && p & 0xfff >= 0x100 && matches!(n, 1 | 2 | 4) {
                if let Some(v) = self.memory.devices.read(p & !3) {
                    return Ok((v >> ((p & 3) * 8)) & (u32::MAX as u64 >> ((4-n)*8)));
                }
            }
            if n != 4 || a & 3 != 0 { return Err(Trap { cause: 5, value: a }); }
            if let Some(v) = self.memory.devices.read(p) {
                return Ok(v);
            }
        }
        self.memory
            .physical_read(p, n, access)
            .map_err(|t| Trap { value: a, ..t })
    }
    pub fn store(&mut self, a: u64, n: usize, v: u64) -> Result<(), Trap> {
        if a & (n as u64 - 1) != 0 {
            let mut addresses = [0u64; 8];
            for j in 0..n {
                let va = a.wrapping_add(j as u64);
                let p = self.memory.translate(
                    va,
                    Access::Write,
                    self.mode,
                    self.csr[0x180],
                    self.csr[0x300],
                )?;
                if p < RAM_BASE || p - RAM_BASE >= self.memory.ram.len() as u64 {
                    return Err(Trap { cause: 7, value: a });
                }
                addresses[j] = p;
            }
            self.reservation = None;
            for j in 0..n {
                self.memory.physical_write(addresses[j], 1, v >> (8 * j))?;
            }
            return Ok(());
        }
        let p = self.memory.translate_size(
            a, n,
            Access::Write,
            self.mode,
            self.csr[0x180],
            self.csr[0x300],
        )?;
        self.reservation = None;
        if (0xc000000..0x10004000).contains(&p) {
            if n != 4 || a & 3 != 0 { return Err(Trap { cause: 7, value: a }); }
            if self.memory.devices.write(p, v as u32) { return Ok(()); }
        }
        self.memory
            .physical_write(p, n, v)
            .map_err(|t| Trap { value: a, ..t })
    }
    pub fn step(&mut self) -> Result<(), Trap> {
        #[cfg(not(target_arch = "wasm32"))]
        { self.last_trace = None; }
        if self.csr[0x320] & 1 == 0 {
            self.cycles = self.cycles.wrapping_add(1);
        }
        if self.interrupt() || self.waiting || self.stopped {
            return Ok(());
        }
        self.wrote_instret = false;
        if self.pc & 1 != 0 {
            return Err(Trap {
                cause: 0,
                value: self.pc,
            });
        }
        let pa = self.memory.translate(self.pc, Access::Fetch, self.mode, self.csr[0x180], self.csr[0x300])?;
        let decoded = if let Some(d) = self.memory.decoded(pa) { d } else {
            // Cross-page instructions must independently translate the upper half.
            let lo = self.load(self.pc, 2, Access::Fetch)? as u32;
            if lo & 3 == 3 {
                let raw = lo | ((self.load(self.pc.wrapping_add(2), 2, Access::Fetch)? as u32) << 16);
                crate::decoded::Decoded::new(raw, raw, 4)
            } else {
                crate::decoded::Decoded::new(lo, crate::compressed::expand(lo as u16).ok_or(self.illegal(lo))?, 2)
            }
        };
        if self.pc & 4095 != 4094 {
            self.memory.translate_size(self.pc, decoded.len as usize, Access::Fetch, self.mode, self.csr[0x180], self.csr[0x300])?;
        }
        #[cfg(not(target_arch = "wasm32"))]
        let trace_pc = self.pc;
        self.execute_decoded(decoded).map_err(|t| {
            if t.cause == 2 { self.illegal(decoded.raw) } else { t }
        })?;
        self.x[0] = 0;
        #[cfg(not(target_arch = "wasm32"))]
        if self.trace_enabled { self.last_trace = Some(TraceEvent::Instruction { pc: trace_pc, raw: decoded.raw }); }
        if !self.wrote_instret && self.csr[0x320] & 4 == 0 {
            self.retired = self.retired.wrapping_add(1);
        }
        self.wrote_instret = false;
        Ok(())
    }
    pub fn service_devices(&mut self) {
        let mut devices = std::mem::take(&mut self.memory.devices);
        devices.service(&mut self.memory);
        self.csr[0x344] = (self.csr[0x344] & !((1 << 11) | (1 << 9))) | devices.interrupts();
        self.memory.devices = devices;
    }
    pub fn run(&mut self, count: u32) {
        for _ in 0..count {
            if let Err(t) = self.step() {
                self.trap(t)
            }
            if self.waiting || self.stopped {
                break;
            }
        }
    }
    pub(crate) fn execute(&mut self, i: u32, len: u64) -> Result<(), Trap> {
        let rd = ((i >> 7) & 31) as usize;
        let rs1 = ((i >> 15) & 31) as usize;
        let rs2 = ((i >> 20) & 31) as usize;
        let a = self.x[rs1];
        let b = self.x[rs2];
        let f = (i >> 12) & 7;
        let top = i >> 25;
        let imm = sext((i >> 20) as u64, 12);
        let mut next = self.pc.wrapping_add(len);
        let mut result = None;
        match i & 127 {
            0x37 => result = Some(word((i & 0xfffff000) as u64)),
            0x17 => result = Some(self.pc.wrapping_add(word((i & 0xfffff000) as u64))),
            0x6f => {
                let off = ((i >> 31) << 20)
                    | (((i >> 12) & 255) << 12)
                    | (((i >> 20) & 1) << 11)
                    | (((i >> 21) & 1023) << 1);
                result = Some(next);
                next = self.pc.wrapping_add(sext(off as u64, 21));
            }
            0x67 if f == 0 => {
                result = Some(next);
                next = a.wrapping_add(imm) & !1;
            }
            0x63 => {
                let yes = match f {
                    0 => a == b,
                    1 => a != b,
                    4 => (a as i64) < (b as i64),
                    5 => (a as i64) >= (b as i64),
                    6 => a < b,
                    7 => a >= b,
                    _ => return Err(self.illegal(i)),
                };
                if yes {
                    let off = ((i >> 31) << 12)
                        | (((i >> 7) & 1) << 11)
                        | (((i >> 25) & 63) << 5)
                        | (((i >> 8) & 15) << 1);
                    next = self.pc.wrapping_add(sext(off as u64, 13));
                }
            }
            0x03 => {
                let size = match f {
                    0 | 4 => 1,
                    1 | 5 => 2,
                    2 | 6 => 4,
                    3 => 8,
                    _ => return Err(self.illegal(i)),
                };
                let v = self.load(a.wrapping_add(imm), size, Access::Read)?;
                result = Some(if f < 4 { sext(v, (size * 8) as u32) } else { v });
            }
            0x23 => {
                let size = match f {
                    0 => 1,
                    1 => 2,
                    2 => 4,
                    3 => 8,
                    _ => return Err(self.illegal(i)),
                };
                let off = sext((((i >> 25) << 5) | ((i >> 7) & 31)) as u64, 12);
                self.store(a.wrapping_add(off), size, b)?;
            }
            0x13 | 0x1b if crate::bits::immediate(i, a).is_some() => {
                result = crate::bits::immediate(i, a)
            }
            0x13 | 0x1b => {
                let w = i & 127 == 0x1b;
                let shift = (i >> 20) & if w { 31 } else { 63 };
                let v = match f {
                    0 => a.wrapping_add(imm),
                    2 if !w => ((a as i64) < (imm as i64)) as u64,
                    3 if !w => (a < imm) as u64,
                    4 if !w => a ^ imm,
                    6 if !w => a | imm,
                    7 if !w => a & imm,
                    1 if i >> 26 == 0 && (!w || top == 0) => a << shift,
                    5 if i >> 26 == 0 && (!w || top == 0) => {
                        if w {
                            (a as u32 >> shift) as u64
                        } else {
                            a >> shift
                        }
                    }
                    5 if i >> 26 == 0x10 && (!w || top == 0x20) => {
                        if w {
                            (a as i32 >> shift) as u64
                        } else {
                            (a as i64 >> shift) as u64
                        }
                    }
                    _ => return Err(self.illegal(i)),
                };
                result = Some(if w { word(v) } else { v });
            }
            0x33 | 0x3b if crate::bits::register(i, a, b).is_some() => {
                result = crate::bits::register(i, a, b)
            }
            0x33 | 0x3b => {
                let w = i & 127 == 0x3b;
                let sh = (b & if w { 31 } else { 63 }) as u32;
                let v = if top == 1 {
                    self.muldiv(a, b, f, w)?
                } else {
                    match (top, f) {
                        (0, 0) => a.wrapping_add(b),
                        (32, 0) => a.wrapping_sub(b),
                        (0, 1) => a << sh,
                        (0, 2) if !w => ((a as i64) < (b as i64)) as u64,
                        (0, 3) if !w => (a < b) as u64,
                        (0, 4) if !w => a ^ b,
                        (0, 5) => {
                            if w {
                                (a as u32 >> sh) as u64
                            } else {
                                a >> sh
                            }
                        }
                        (32, 5) => {
                            if w {
                                (a as i32 >> sh) as u64
                            } else {
                                (a as i64 >> sh) as u64
                            }
                        }
                        (0, 6) if !w => a | b,
                        (0, 7) if !w => a & b,
                        _ => return Err(self.illegal(i)),
                    }
                };
                result = Some(if w { word(v) } else { v });
            }
            0x07 if f == 2 || f == 3 => {
                if self.csr[0x300] & (3 << 13) == 0 {
                    return Err(self.illegal(i));
                }
                let v = self.load(
                    a.wrapping_add(imm),
                    if f == 2 { 4 } else { 8 },
                    Access::Read,
                )?;
                self.f[rd] = if f == 2 { v | 0xffffffff00000000 } else { v };
                self.csr[0x300] |= (3 << 13) | (1 << 63);
            }
            0x27 if f == 2 || f == 3 => {
                if self.csr[0x300] & (3 << 13) == 0 {
                    return Err(self.illegal(i));
                }
                let off = sext((((i >> 25) << 5) | ((i >> 7) & 31)) as u64, 12);
                self.store(a.wrapping_add(off), if f == 2 { 4 } else { 8 }, self.f[rs2])?;
            }
            0x43 | 0x47 | 0x4b | 0x4f | 0x53 => self.fp(i)?,
            0x0f if f <= 1 => {}
            0x2f if f == 2 || f == 3 => {
                let size = if f == 2 { 4 } else { 8 };
                let op = i >> 27;
                if a & (size - 1) as u64 != 0 {
                    return Err(Trap {
                        cause: if op == 2 { 4 } else { 6 },
                        value: a,
                    });
                }
                let access = if op == 2 { Access::Read } else { Access::Write };
                let pa = self.memory.translate_size(
                    a, size,
                    access,
                    self.mode,
                    self.csr[0x180],
                    self.csr[0x300],
                )?;
                if op == 3 {
                    let success = self.reservation == Some((pa, size));
                    self.reservation = None;
                    if success {
                        self.memory.physical_write(pa, size, b)?;
                    }
                    result = Some((!success) as u64);
                } else {
                    let old = self.memory.physical_read(pa, size, access)?;
                    if op == 2 {
                        if rs2 != 0 {
                            return Err(self.illegal(i));
                        }
                        self.reservation = Some((pa, size));
                    } else {
                        let lhs = if size == 4 { word(old) } else { old };
                        let rhs = if size == 4 { word(b) } else { b };
                        let value = match op {
                            0 => old.wrapping_add(b),
                            1 => b,
                            4 => old ^ b,
                            8 => old | b,
                            12 => old & b,
                            16 => {
                                if (lhs as i64) < (rhs as i64) {
                                    old
                                } else {
                                    b
                                }
                            }
                            20 => {
                                if (lhs as i64) > (rhs as i64) {
                                    old
                                } else {
                                    b
                                }
                            }
                            24 => {
                                if lhs < rhs {
                                    old
                                } else {
                                    b
                                }
                            }
                            28 => {
                                if lhs > rhs {
                                    old
                                } else {
                                    b
                                }
                            }
                            _ => return Err(self.illegal(i)),
                        };
                        self.memory.physical_write(pa, size, value)?;
                        self.reservation = None;
                    }
                    result = Some(if size == 4 { word(old) } else { old });
                }
            }
            0x73 => {
                if f != 0 {
                    let n = (i >> 20) as usize;
                    let src = if f & 4 != 0 { rs1 as u64 } else { a };
                    let op = f & 3;
                    if op == 0 {
                        return Err(self.illegal(i));
                    }
                    let old = if op == 1 && rd == 0 {
                        0
                    } else {
                        self.read_csr(n).map_err(|_| self.illegal(i))?
                    };
                    if op == 1 || rs1 != 0 {
                        let value = match op {
                            1 => src,
                            2 => old | src,
                            _ => old & !src,
                        };
                        self.write_csr(n, value).map_err(|_| self.illegal(i))?;
                    }
                    result = Some(old);
                } else {
                    match i {
                        0x00000073 if self.sbi && self.mode == Mode::S => self.sbi_call(),
                        0x00000073 => {
                            return Err(Trap {
                                cause: 8 + self.mode as u64,
                                value: 0,
                            })
                        }
                        0x00100073 => {
                            return Err(Trap {
                                cause: 3,
                                value: self.pc,
                            })
                        }
                        0x10500073 => {
                            if self.mode == Mode::U
                                || (self.mode != Mode::M && self.csr[0x300] & (1 << 21) != 0)
                            {
                                return Err(self.illegal(i));
                            }
                            self.waiting = true;
                        }
                        0x30200073 if self.mode == Mode::M => {
                            let s = self.csr[0x300];
                            self.mode = Mode::from_bits((s >> 11) & 3);
                            self.csr[0x300] = (s & !((1 << 3) | (1 << 7) | (3 << 11)))
                                | ((s & (1 << 7)) >> 4)
                                | (1 << 7);
                            if self.mode != Mode::M {
                                self.csr[0x300] &= !(1 << 17)
                            }
                            next = self.csr[0x341];
                            self.reservation = None;
                        }
                        0x10200073 if self.mode != Mode::U => {
                            let s = self.csr[0x300];
                            if self.mode == Mode::S && s & (1 << 22) != 0 {
                                return Err(self.illegal(i));
                            }
                            self.mode = if s & (1 << 8) != 0 { Mode::S } else { Mode::U };
                            self.csr[0x300] = (s & !((1 << 1) | (1 << 5) | (1 << 8) | (1 << 17)))
                                | ((s & (1 << 5)) >> 4)
                                | (1 << 5);
                            next = self.csr[0x141];
                            self.reservation = None;
                        }
                        _ if i & 0xfe007fff == 0x12000073 && self.mode != Mode::U => {
                            if self.mode == Mode::S && self.csr[0x300] & (1 << 20) != 0 {
                                return Err(self.illegal(i));
                            }
                            self.memory.flush();
                        }
                        _ => return Err(self.illegal(i)),
                    }
                }
            }
            _ => return Err(self.illegal(i)),
        }
        if next & 1 != 0 {
            return Err(Trap {
                cause: 0,
                value: next,
            });
        }
        if let Some(v) = result {
            if rd != 0 {
                self.x[rd] = v;
            }
        }
        self.pc = next;
        Ok(())
    }
    fn muldiv(&self, a: u64, b: u64, f: u32, w: bool) -> Result<u64, Trap> {
        let aa = if w { word(a) } else { a };
        let bb = if w { word(b) } else { b };
        let ua = if w { a as u32 as u64 } else { a };
        let ub = if w { b as u32 as u64 } else { b };
        Ok(match f {
            0 => a.wrapping_mul(b),
            1 if !w => (((a as i64 as i128) * (b as i64 as i128)) >> 64) as u64,
            2 if !w => (((a as i64 as i128) * (b as i128)) >> 64) as u64,
            3 if !w => (((a as u128) * (b as u128)) >> 64) as u64,
            4 => {
                if bb == 0 {
                    u64::MAX
                } else {
                    (aa as i64).wrapping_div(bb as i64) as u64
                }
            }
            5 => {
                if ub == 0 {
                    u64::MAX
                } else {
                    ua / ub
                }
            }
            6 => {
                if bb == 0 {
                    aa
                } else {
                    (aa as i64).wrapping_rem(bb as i64) as u64
                }
            }
            7 => {
                if ub == 0 {
                    ua
                } else {
                    ua % ub
                }
            }
            _ => return Err(Trap { cause: 2, value: 0 }),
        })
    }
}
