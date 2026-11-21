//! Trusted upstream ELF runner, signature dump for architectural tests.
use rv64_core::{elf, Access, Cpu};
use std::{fs::File, io::Write};
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
    let mut result = 0;
    for n in 0..max {
        cpu.time(n / 10);
        if let Err(t) = cpu.step() {
            cpu.trap(t)
        }
        result = cpu
            .memory
            .physical_read(host, 8, Access::Read)
            .map_err(|e| format!("tohost: {e:?}"))?;
        if result != 0 {
            break;
        }
    }
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
