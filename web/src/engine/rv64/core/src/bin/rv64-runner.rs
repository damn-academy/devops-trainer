//! Trusted upstream ELF runner, signature dump for architectural tests.
use rv64_core::{elf, Access, Cpu};
use std::{fs::File, io::{Write, BufWriter}};
use rv64_core::cpu::TraceEvent;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let arg = |name: &str| {
        args.iter()
            .position(|a| a == name)
            .and_then(|i| args.get(i + 1))
    };
    let path = arg("--elf").ok_or("--elf required")?;
    let mut cpu = Cpu::new(64 << 20);
    let symbols = elf::load(&mut cpu, &std::fs::read(path)?);
    let host = *symbols.get("tohost").ok_or("missing tohost")?;
    let max = arg("--max-insns")
        .map(|s| s.parse())
        .transpose()?
        .unwrap_or(10_000_000u64);
    let mut trace = arg("--trace").map(File::create).transpose()?.map(BufWriter::new);
    cpu.trace_enabled = trace.is_some();
    if let Some(out) = &mut trace { writeln!(out, "# tracediff v1 model=rv64-core isa=rv64imafdc_zicsr_zifencei_zicntr_zba_zbb_zbs_sstc_svadu")?; }
    let mut result = 0;
    for n in 0..max {
        cpu.time(n / 10);
        let before = trace.as_ref().map(|_| cpu.csr);
        if let Err(t) = cpu.step() {
            cpu.trap(t)
        }
        if let Some(out) = &mut trace {
            match cpu.last_trace {
                Some(TraceEvent::Trap { pc, trap, target }) => writeln!(out, "t {pc:016x} {:04x} {:016x} {target:016x}", trap.cause, trap.value)?,
                Some(TraceEvent::Instruction { pc, raw }) => {
                    let ins = if raw & 3 == 3 { raw } else { rv64_core::expand_compressed(raw as u16).unwrap() };
                    let rd = ((ins >> 7) & 31) as usize;
                    let opcode = ins & 127;
                    let integer = matches!(opcode, 3|0x13|0x17|0x1b|0x2f|0x33|0x37|0x3b|0x67|0x6f)
                        || (opcode == 0x73 && (ins >> 12) & 7 != 0)
                        || (opcode == 0x53 && matches!(ins >> 25, 0x50|0x51|0x60|0x61|0x70|0x71));
                    let floating = !integer && matches!(opcode, 7|0x43|0x47|0x4b|0x4f|0x53);
                    let reg = if integer && rd != 0 { format!("x{rd}={:016x}", cpu.x[rd]) }
                        else if floating { format!("f{rd}={:016x}", cpu.f[rd]) } else { "-".into() };
                    let mut changes = std::collections::BTreeMap::new();
                    let old = before.as_ref().unwrap();
                    for (n, name) in [(0x300,"mstatus"),(0x104,"sie"),(0x105,"stvec"),(0x106,"scounteren"),(0x140,"sscratch"),(0x141,"sepc"),(0x142,"scause"),(0x143,"stval"),(0x14d,"stimecmp"),(0x180,"satp"),(0x302,"medeleg"),(0x303,"mideleg"),(0x304,"mie"),(0x305,"mtvec"),(0x306,"mcounteren"),(0x30a,"menvcfg"),(0x320,"mcountinhibit"),(0x340,"mscratch"),(0x341,"mepc"),(0x342,"mcause"),(0x343,"mtval"),(0x344,"mip")] {
                        if old[n] != cpu.csr[n] { changes.insert(name.to_string(), cpu.csr[n]); }
                    }
                    if old[3] & 31 != cpu.csr[3] & 31 { changes.insert("fflags".into(), cpu.csr[3] & 31); }
                    if old[3] >> 5 != cpu.csr[3] >> 5 { changes.insert("frm".into(), cpu.csr[3] >> 5); }
                    let f = (ins >> 12) & 7;
                    if opcode == 0x73 && (matches!(f,1|5) || (f != 0 && (ins >> 15) & 31 != 0)) {
                        let n = (ins >> 20) as usize;
                        let name = match n {
                            1 => "fflags".into(), 2 => "frm".into(), 3 => "fcsr".into(),
                            0x100|0x300 => "mstatus".into(), 0x104|0x304 => "mie".into(), 0x144|0x344 => "mip".into(),
                            0x105 => "stvec".into(), 0x106 => "scounteren".into(), 0x140 => "sscratch".into(),
                            0x141 => "sepc".into(), 0x142 => "scause".into(), 0x143 => "stval".into(), 0x14d => "stimecmp".into(),
                            0x180 => "satp".into(), 0x302 => "medeleg".into(), 0x303 => "mideleg".into(), 0x305 => "mtvec".into(),
                            0x306 => "mcounteren".into(), 0x30a => "menvcfg".into(), 0x320 => "mcountinhibit".into(),
                            0x340 => "mscratch".into(), 0x341 => "mepc".into(), 0x342 => "mcause".into(), 0x343 => "mtval".into(),
                            0xb00 => "mcycle".into(), 0xb02 => "minstret".into(),
                            0x3a0|0x3a2 => format!("pmpcfg{}", n-0x3a0), 0x3b0..=0x3bf => format!("pmpaddr{}",n-0x3b0),
                            _ => format!("csr{n:03x}"),
                        };
                        let value = match n {0x100|0x300=>cpu.csr[0x300],0x104|0x304=>cpu.csr[0x304],0x144|0x344=>cpu.csr[0x344],_=>cpu.read_csr(n).unwrap()};
                        if n == 3 { changes.insert("fflags".into(),value&31); changes.insert("frm".into(),value>>5); }
                        else { changes.insert(name,value); }
                    }
                    if let Some(status) = changes.get_mut("mstatus") { *status = (*status & !(1 << 63)) | (((*status >> 13) & 3 == 3) as u64) << 63; }
                    let csr = if changes.is_empty() { "-".into() } else { changes.into_iter().map(|(name,v)|format!("{name}={v:016x}")).collect::<Vec<_>>().join(",") };
                    writeln!(out, "i {pc:016x} {raw:08x} {reg} {csr}")?;
                }
                None => {},
            }
        }
        result = cpu
            .memory
            .physical_read(host, 8, Access::Read)
            .map_err(|e| format!("tohost: {e:?}"))?;
        if result != 0 {
            break;
        }
    }
    if let Some(out) = &mut trace { out.flush()?; }
    if args.iter().any(|a| a == "--metrics") { eprintln!("METRICS {}", cpu.memory.metrics.json()); }
    if result != 1 {
        return Err(format!(
            "tohost={result:#x}, pc={:#x}, mcause={}, mtval={:#x}",
            cpu.pc, cpu.csr[0x342], cpu.csr[0x343]
        )
        .into());
    }
    if let Some(path) = arg("--signature") {
        let start = *symbols
            .get("begin_signature")
            .ok_or("missing begin_signature")?;
        let end = *symbols
            .get("end_signature")
            .ok_or("missing end_signature")?;
        let mut file = File::create(path)?;
        for address in (start..end).step_by(16) {
            for j in (0..16).rev() {
                let value = if address + j < end {
                    cpu.memory
                        .physical_read(address + j, 1, Access::Read)
                        .map_err(|e| format!("signature: {e:?}"))?
                } else {
                    0
                };
                write!(file, "{value:02x}")?;
            }
            writeln!(file)?;
        }
    }
    Ok(())
}
