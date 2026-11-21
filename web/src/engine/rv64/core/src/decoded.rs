//! Dense decoded integer operations. Uncommon/privileged/FP encodings use the
//! precise interpreter. Register indexes are masked where used (bounds proven).
use crate::{Cpu, Trap, Access};
#[derive(Clone, Copy, Default)]
pub struct Decoded {
    pub raw: u32, pub ins: u32, pub len: u64,
    imm: u64, op: u8, rd: u8, rs1: u8, rs2: u8, f: u8,
}
fn sx(v: u32, bits: u32) -> u64 { ((v as i32) << (32-bits) >> (32-bits)) as i64 as u64 }
impl Decoded {
    pub fn new(raw: u32, ins: u32, len: u64) -> Self {
        let f = (ins >> 12) & 7; let top = ins >> 25;
        let mut d = Self { raw, ins, len, imm: sx(ins >> 20, 12), op: 0, rd: (ins >> 7) as u8 & 31, rs1: (ins >> 15) as u8 & 31, rs2: (ins >> 20) as u8 & 31, f: f as u8 };
        d.op = match ins & 127 {
            0x13 if f == 0 => 1,
            0x1b if f == 0 => 2,
            0x33 if top == 0 => 3,
            0x3b if top == 0 && matches!(f, 0|1|5) => 4,
            0x33 if top == 32 && f == 0 => 5,
            0x3b if top == 32 && f == 0 => 6,
            0x13 if matches!(f, 2|3|4|6|7) => 7,
            0x13 if f == 1 && ins >> 26 == 0 => { d.imm = ((ins >> 20)&63) as u64; 8 },
            0x13 if f == 5 && ins >> 26 == 0 => { d.imm = ((ins >> 20)&63) as u64; 9 },
            0x13 if f == 5 && ins >> 26 == 16 => { d.imm = ((ins >> 20)&63) as u64; 10 },
            0x03 if f < 7 => 11,
            0x23 if f < 4 => { d.imm = sx(((ins >> 25)<<5)|((ins>>7)&31),12); 12 },
            0x63 if matches!(f,0|1|4|5|6|7) => { d.imm = sx(((ins>>31)<<12)|(((ins>>7)&1)<<11)|(((ins>>25)&63)<<5)|(((ins>>8)&15)<<1),13); 13 },
            0x37 => { d.imm = (ins & 0xfffff000) as i32 as i64 as u64; 14 },
            0x17 => { d.imm = (ins & 0xfffff000) as i32 as i64 as u64; 15 },
            0x6f => { d.imm = sx(((ins>>31)<<20)|(((ins>>12)&255)<<12)|(((ins>>20)&1)<<11)|(((ins>>21)&1023)<<1),21); 16 },
            0x67 if f == 0 => 17,
            _ => 0,
        };
        d
    }
}
impl Cpu {
    #[inline]
    pub(crate) fn execute_decoded(&mut self, d: Decoded) -> Result<(), Trap> {
        let a = self.x[(d.rs1 & 31) as usize]; let b = self.x[(d.rs2 & 31) as usize];
        let mut next = self.pc.wrapping_add(d.len);
        let value = match d.op {
            1 => a.wrapping_add(d.imm),
            2 => a.wrapping_add(d.imm) as i32 as i64 as u64,
            3|4 => {
                let sh = b & if d.op == 4 {31} else {63};
                let v = match d.f {
                    0 => a.wrapping_add(b), 1 => a << sh,
                    2 => ((a as i64)<(b as i64)) as u64, 3 => (a<b) as u64,
                    4 => a^b, 5 => if d.op == 4 {(a as u32 >> sh) as u64} else {a>>sh},
                    6 => a|b, _ => a&b,
                };
                if d.op == 4 {v as i32 as i64 as u64} else {v}
            }
            5 => a.wrapping_sub(b), 6 => a.wrapping_sub(b) as i32 as i64 as u64,
            7 => match d.f {2=>((a as i64)<(d.imm as i64)) as u64,3=>(a<d.imm) as u64,4=>a^d.imm,6=>a|d.imm,_=>a&d.imm},
            8 => a << d.imm, 9 => a >> d.imm, 10 => ((a as i64) >> d.imm) as u64,
            11 => {
                let size = 1 << (d.f & 3);
                let v = self.load(a.wrapping_add(d.imm), size, Access::Read)?;
                if d.f < 4 { let shift = 64-size*8; ((v << shift) as i64 >> shift) as u64 } else {v}
            }
            12 => { self.store(a.wrapping_add(d.imm), 1 << d.f, b)?; self.pc = next; return Ok(()); }
            13 => {
                let yes = match d.f {0=>a==b,1=>a!=b,4=>(a as i64)<(b as i64),5=>(a as i64)>=(b as i64),6=>a<b,_=>a>=b};
                self.pc = if yes {self.pc.wrapping_add(d.imm)} else {next}; return Ok(());
            }
            14 => d.imm, 15 => self.pc.wrapping_add(d.imm),
            16 => {let link=next;next=self.pc.wrapping_add(d.imm);link},
            17 => {let link=next;next=a.wrapping_add(d.imm)&!1;link},
            _ => return self.execute(d.ins, d.len),
        };
        if d.rd != 0 { self.x[(d.rd & 31) as usize] = value; }
        self.pc = next;
        Ok(())
    }
}
