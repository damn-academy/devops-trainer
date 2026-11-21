//! Native boot/measurement runner. Execute only in the workshop pod.
use rv64_core::{fdt, Cpu, RAM_BASE};
use std::{
    io::{Read, Write},
    time::{Duration, Instant},
};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = std::env::args().collect::<Vec<_>>();
    if args.len() < 3 {
        return Err("usage: boot KERNEL INITRAMFS [seconds] [cmdline]".into());
    }
    let kernel = std::fs::read(&args[1])?;
    let initrd = std::fs::read(&args[2])?;
    let seconds = args.get(3).map(|s| s.parse()).transpose()?.unwrap_or(120);
    let cmdline = args
        .get(4)
        .map(String::as_str)
        .unwrap_or("earlycon=sbi console=hvc0 rdinit=/bin/sh loglevel=7 nokaslr");
    let memory_mb = std::env::var("RV64_MEMORY_MB").ok().map(|v| v.parse::<usize>()).transpose()?.unwrap_or(512);
    let mut cpu = Cpu::new(memory_mb * 1024 * 1024);
    if let Some(path) = std::env::var_os("RV64_DISK") { cpu.memory.devices.disk = std::fs::read(path)?; }
    let entry = RAM_BASE + 0x200000;
    let rd = RAM_BASE + 0x8000000;
    let dtb = RAM_BASE + 0x4000000;
    cpu.memory
        .load_image(entry, &kernel)
        .map_err(|e| format!("kernel {e:?}"))?;
    cpu.memory
        .load_image(rd, &initrd)
        .map_err(|e| format!("initrd {e:?}"))?;
    let tree = fdt::build(
        cpu.memory.ram.len() as u64,
        rd,
        initrd.len() as u64,
        cmdline,
    );
    // Linux image_size includes BSS beyond the on-disk file; reserve 64 MiB before DTB.
    cpu.memory
        .load_image(dtb, &tree)
        .map_err(|e| format!("dtb {e:?}"))?;
    cpu.boot_supervisor(entry, dtb);
    let start = Instant::now();
    let mut stdout = std::io::stdout();
    let mut random = std::fs::File::open("/dev/urandom")?;
    let benchmark = std::env::var_os("RV64_COREMARK").is_some();
    let mut bench_start = None;
    let mut bench_retired = 0;
    let mut faults = 0;
    let trace = std::env::var_os("RV64_TRACE").is_some();
    let mut last = Instant::now();
    let mut output = String::new();
    let mut sent = false;
    let mut shell = false;
    while start.elapsed() < Duration::from_secs(seconds) && !cpu.stopped {
        cpu.time((start.elapsed().as_nanos() / 100) as u64);
        if cpu.memory.devices.entropy.len() < 4096 {
            let mut entropy = [0; 4096];
            random.read_exact(&mut entropy)?;
            cpu.memory.devices.entropy.extend(entropy);
        }
        cpu.service_devices();
        if trace {
            for _ in 0..4096 {
                if let Err(t) = cpu.step() {
                    if faults < 100 {
                        eprintln!(
                            "trap pc={:#x} mode={:?} cause={} value={:#x} pa={:?}",
                            cpu.pc,
                            cpu.mode,
                            t.cause,
                            t.value,
                            cpu.memory.translate(
                                t.value,
                                rv64_core::Access::Write,
                                cpu.mode,
                                cpu.csr[0x180],
                                cpu.csr[0x300]
                            )
                        );
                    }
                    if faults < 100 {
                        eprintln!("regs={:x?}", cpu.x);
                    }
                    faults += 1;
                    cpu.trap(t);
                }
                if cpu.waiting || cpu.stopped {
                    break;
                }
            }
        } else {
            cpu.run(4096);
        }
        cpu.console.append(&mut cpu.memory.devices.console);
        if !cpu.console.is_empty() {
            stdout.write_all(&cpu.console)?;
            stdout.flush()?;
            output.push_str(&String::from_utf8_lossy(&cpu.console));
            cpu.console.clear();
        }
        if !sent && (output.contains("/ #") || output.contains("~ #")) {
            eprintln!("BOOT_SHELL_MS={}", start.elapsed().as_millis());
            if benchmark {
                cpu.memory
                    .devices
                    .input
                    .extend(b"/bin/coremark; echo RV64_BENCH_DONE\n");
                bench_start = Some(Instant::now());
                bench_retired = cpu.retired;
            } else {
                cpu.memory
                    .devices
                    .input
                    .extend(b"echo RV64_SHELL_OK; uname -a\n");
            }
            sent = true;
        }
        if output.contains("RV64_SHELL_OK\r\n") || output.contains("RV64_SHELL_OK\n") {
            shell = true;
            break;
        }
        if benchmark
            && (output.contains("\nRV64_BENCH_DONE\r\n") || output.contains("\nRV64_BENCH_DONE\n"))
        {
            let elapsed = bench_start.unwrap().elapsed().as_secs_f64();
            eprintln!(
                "COREMARK_WALL_SECONDS={elapsed} COREMARK_EFFECTIVE_MIPS={}",
                (cpu.retired - bench_retired) as f64 / elapsed / 1e6
            );
            shell = true;
            break;
        }
        if output.len() > 100000 {
            output.drain(..50000);
        }
        if cpu.waiting {
            std::thread::sleep(Duration::from_micros(50));
        }
        if last.elapsed() > Duration::from_secs(10) {
            eprintln!(
                "progress pc={:#x} retired={} scause={} stval={:#x} mcause={} mtval={:#x}",
                cpu.pc, cpu.retired, cpu.csr[0x142], cpu.csr[0x143], cpu.csr[0x342], cpu.csr[0x343]
            );
            last = Instant::now();
        }
    }
    eprintln!(
        "elapsed_ms={} retired={} effective_mips={:.3} shell={shell}",
        start.elapsed().as_millis(),
        cpu.retired,
        cpu.retired as f64 / start.elapsed().as_secs_f64() / 1e6
    );
    eprintln!("SBI_TIME_CALLS={} STIMECMP_WRITES={}",cpu.sbi_timer_calls,cpu.stimecmp_writes);
    if !shell {
        eprintln!("{}", cpu.memory.devices.diagnostics(&cpu.memory));
        return Err("shell acceptance marker not reached".into());
    }
    Ok(())
}
