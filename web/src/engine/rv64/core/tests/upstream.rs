//! Upstream binaries are built in the pod by scripts/rv64-build-tests.sh.
//! Opt in with RV64_ISA_DIR: absence is an explicit ignored test, not a pass.
use rv64_core::{Access, Cpu};
#[test]
#[ignore = "requires pod-built upstream binaries; RV64_ISA_DIR=/work/tests/isa cargo test --release --test upstream -- --ignored --nocapture"]
fn riscv_tests() {
    let dir = std::env::var("RV64_ISA_DIR").expect("RV64_ISA_DIR is required");
    let filter = std::env::var("RV64_ISA_FILTER").unwrap_or_default();
    let mut paths = std::fs::read_dir(dir)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| {
            p.extension().is_none()
                && p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with(&filter)
        })
        .collect::<Vec<_>>();
    paths.sort();
    assert!(!paths.is_empty());
    let (mut pass, mut fail, mut unsupported) = (0, 0, 0);
    for path in paths {
        let name = path.file_name().unwrap().to_string_lossy();
        // This test unconditionally accesses tselect and assumes Sdtrig exists.
        // Sdtrig is outside our ISA; absent trigger CSRs must trap, not fake a pass.
        if name == "rv64mi-p-breakpoint" {
            unsupported += 1;
            println!("UNSUPPORTED {name}: optional Sdtrig trigger CSRs are absent");
            continue;
        }
        let mut cpu = Cpu::new(16 * 1024 * 1024);
        let symbols = rv64_core::elf::load(&mut cpu, &std::fs::read(&path).unwrap());
        let host = symbols["tohost"];
        let mut value = 0;
        for n in 0..2_000_000u64 {
            cpu.time(n / 10);
            if let Err(t) = cpu.step() {
                cpu.trap(t)
            }
            value = cpu.memory.physical_read(host, 8, Access::Read).unwrap();
            if value != 0 {
                break;
            }
        }
        if value == 1 {
            pass += 1;
            println!("PASS {name}")
        } else {
            fail += 1;
            println!(
                "FAIL {name}: tohost={value:#x} pc={:#x} cause={} tval={:#x} test={}",
                cpu.pc, cpu.csr[0x342], cpu.csr[0x343], cpu.x[3]
            );
        }
    }
    println!("UPSTREAM RESULT pass={pass} fail={fail} unsupported={unsupported}");
    assert_eq!(fail, 0);
}
