use rv64_core::{Access, Cpu, Memory, Mode, RAM_BASE};
fn put(m: &mut Memory, a: u64, v: u64) {
    m.physical_write(a, 8, v).unwrap()
}
fn mapping() -> (Memory, u64) {
    let mut m = Memory::new(0x10000);
    put(&mut m, RAM_BASE, ((RAM_BASE + 0x1000) >> 12) << 10 | 1);
    put(
        &mut m,
        RAM_BASE + 0x1000,
        ((RAM_BASE + 0x2000) >> 12) << 10 | 1,
    );
    put(
        &mut m,
        RAM_BASE + 0x2000,
        ((RAM_BASE + 0x3000) >> 12) << 10 | 0x1f,
    );
    (m, (8 << 60) | (RAM_BASE >> 12))
}
#[test]
fn sv39_permissions_and_ad() {
    let (mut m, s) = mapping();
    assert_eq!(
        m.translate(123, Access::Read, Mode::U, s, 0).unwrap(),
        RAM_BASE + 0x3000 + 123
    );
    assert_eq!(
        m.physical_read(RAM_BASE + 0x2000, 8, Access::Read).unwrap() & 0xc0,
        0x40
    );
    m.translate(0, Access::Write, Mode::U, s, 0).unwrap();
    assert_eq!(
        m.physical_read(RAM_BASE + 0x2000, 8, Access::Read).unwrap() & 0xc0,
        0xc0
    );
    assert_eq!(
        m.translate(0, Access::Read, Mode::S, s, 0)
            .unwrap_err()
            .cause,
        13
    );
    assert!(m.translate(0, Access::Read, Mode::S, s, 1 << 18).is_ok());
    assert_eq!(
        m.translate(0, Access::Fetch, Mode::S, s, 1 << 18)
            .unwrap_err()
            .cause,
        12
    );
}
#[test]
fn sv39_noncanonical() {
    let (mut m, s) = mapping();
    assert_eq!(
        m.translate(1 << 39, Access::Read, Mode::U, s, 0)
            .unwrap_err()
            .value,
        1 << 39
    );
}
#[test]
fn tlb_flush_changes_mapping() {
    let (mut m, s) = mapping();
    m.translate(0, Access::Read, Mode::U, s, 0).unwrap();
    put(
        &mut m,
        RAM_BASE + 0x2000,
        ((RAM_BASE + 0x4000) >> 12) << 10 | 0x5f,
    );
    assert_eq!(
        m.translate(0, Access::Read, Mode::U, s, 0).unwrap(),
        RAM_BASE + 0x3000
    );
    m.flush();
    assert_eq!(
        m.translate(0, Access::Read, Mode::U, s, 0).unwrap(),
        RAM_BASE + 0x4000
    );
}
#[test]
fn mprv_does_not_affect_fetch() {
    let (mut m, s) = mapping();
    let status = (1 << 17) | (1 << 11) | (1 << 18);
    assert_eq!(
        m.translate(0, Access::Read, Mode::M, s, status).unwrap(),
        RAM_BASE + 0x3000
    );
    assert_eq!(
        m.translate(0, Access::Fetch, Mode::M, s, status).unwrap(),
        0
    );
}
#[test]
fn real_time_is_independent_of_retirement() {
    let mut c = Cpu::new(4096);
    c.time(12345);
    assert_eq!(c.read_csr(0xc01).unwrap(), 12345);
    assert_eq!(c.retired, 0);
    c.time(100);
    assert_eq!(c.read_csr(0xc01).unwrap(), 12345);
    c.mode = Mode::U;
    assert!(c.read_csr(0xc01).is_err());
    c.csr[0x306] = 2;
    c.csr[0x106] = 2;
    assert_eq!(c.read_csr(0xc01).unwrap(), 12345);
}
#[test]
fn sstc_interrupt_and_wfi() {
    let mut c = Cpu::new(4096);
    c.mode = Mode::S;
    c.waiting = true;
    c.csr[0x30a] = 1 << 63;
    c.csr[0x14d] = 50;
    c.csr[0x303] = 32;
    c.csr[0x304] = 32;
    c.csr[0x300] |= 2;
    c.csr[0x105] = RAM_BASE + 0x100;
    c.time(50);
    c.step().unwrap();
    assert!(!c.waiting);
    assert_eq!(c.pc, RAM_BASE + 0x100);
    assert_eq!(c.csr[0x142], (1 << 63) | 5);
}
#[test]
fn cross_page_instruction_fetch() {
    let mut c = Cpu::new(8192);
    c.pc = RAM_BASE + 4094;
    c.memory
        .load_image(c.pc, &0x02a00513u32.to_le_bytes())
        .unwrap();
    c.step().unwrap();
    assert_eq!(c.x[10], 42);
    assert_eq!(c.pc, RAM_BASE + 4098);
}
#[test]
fn sbi_probe_and_unknown() {
    let mut c = Cpu::new(4096);
    c.memory
        .load_image(RAM_BASE, &0x00000073u32.to_le_bytes())
        .unwrap();
    c.boot_supervisor(RAM_BASE, 0);
    c.x[17] = 0x10;
    c.x[16] = 3;
    c.x[10] = 0x54494d45;
    c.step().unwrap();
    assert_eq!((c.x[10], c.x[11]), (0, 1));
    c.pc = RAM_BASE;
    c.x[17] = 0xdead;
    c.step().unwrap();
    assert_eq!(c.x[10], (-2i64) as u64);
}
#[test]
fn invalid_instruction_is_precise() {
    let mut c = Cpu::new(4096);
    c.memory
        .load_image(RAM_BASE, &0xffffffffu32.to_le_bytes())
        .unwrap();
    let t = c.step().unwrap_err();
    assert_eq!(t.cause, 2);
    assert_eq!(c.pc, RAM_BASE);
    assert_eq!(c.retired, 0);
    assert_eq!(t.value, 0xffffffff);
}
#[test]
fn virtio_console_queue_and_plic() {
    let mut c = Cpu::new(0x10000);
    let base = 0x10002000;
    let desc = RAM_BASE;
    let avail = RAM_BASE + 0x1000;
    let used = RAM_BASE + 0x2000;
    let data = RAM_BASE + 0x3000;
    c.memory.load_image(data, b"hello").unwrap();
    put(&mut c.memory, desc, data);
    put(&mut c.memory, desc + 8, 5);
    put(&mut c.memory, avail, 1 << 16);
    for (off, v) in [
        (0x24, 1),
        (0x20, 1),
        (0x70, 15),
        (0x30, 1),
        (0x38, 8),
        (0x80, desc as u32),
        (0x90, avail as u32),
        (0xa0, used as u32),
        (0x44, 1),
    ] {
        assert!(c.memory.devices.write(base + off, v));
    }
    c.memory.devices.write(0xc00000c, 1);
    c.memory.devices.write(0xc002080, 8);
    c.service_devices();
    assert_eq!(c.memory.devices.console, b"hello");
    assert_eq!(
        c.memory.physical_read(used + 2, 2, Access::Read).unwrap(),
        1
    );
    assert_eq!(c.csr[0x344] & (1 << 9), 1 << 9);
    assert_eq!(c.memory.devices.read(0xc201004), Some(3));
    assert_eq!(c.memory.devices.read(0xc201004), Some(0));
    c.memory.devices.write(base + 0x64, 1);
    c.memory.devices.write(0xc201004, 3);
    c.service_devices();
    assert_eq!(c.csr[0x344] & (1 << 9), 0);
}
#[test]
fn malformed_virtqueue_is_bounded() {
    let mut c = Cpu::new(4096);
    let b = 0x10003000;
    c.memory.devices.entropy.push_back(1);
    for (o, v) in [
        (0x24, 1),
        (0x20, 1),
        (0x70, 15),
        (0x38, 8),
        (0x90, 0xfffffff0),
        (0x44, 1),
    ] {
        c.memory.devices.write(b + o, v);
    }
    c.service_devices();
    assert_eq!(c.memory.devices.read(b + 0x70).unwrap() & 64, 64);
}
#[test]
fn device_tree_header() {
    let b = rv64_core::fdt::build(512 << 20, RAM_BASE + 0x8000000, 1024, "console=hvc0");
    assert_eq!(&b[..4], &0xd00dfeedu32.to_be_bytes());
    assert_eq!(
        u32::from_be_bytes(b[4..8].try_into().unwrap()) as usize,
        b.len()
    );
}

#[test]
fn fp_saturating_overflow_sets_of_and_nx() {
    for rm in [1u32, 2u32] {
        let mut cpu = Cpu::new(4096);
        cpu.csr[0x300] |= 3 << 13;
        cpu.f[1] = 0x7fefffffffffffff;
        cpu.f[2] = 0x7fefffffffffffff;
        let ins = (1 << 25) | (2 << 20) | (1 << 15) | (rm << 12) | (3 << 7) | 0x53;
        cpu.memory.load_image(RAM_BASE, &ins.to_le_bytes()).unwrap();
        cpu.step().unwrap();
        assert_eq!(cpu.f[3], 0x7fefffffffffffff);
        assert_eq!(cpu.csr[3] & 31, 5);
    }
}

#[test]
fn compressed_lui_x0_is_a_hint() {
    let mut cpu = Cpu::new(4096);
    cpu.memory.load_image(RAM_BASE, &0x6005u16.to_le_bytes()).unwrap();
    cpu.step().unwrap();
    assert_eq!(cpu.pc, RAM_BASE + 2);
    assert_eq!(cpu.x[0], 0);
}

#[test]
fn sbi_reset_distinguishes_reboot_from_shutdown() {
    for reset_type in 0..=2 {
        let mut cpu = Cpu::new(4096);
        cpu.memory.load_image(RAM_BASE, &0x00000073u32.to_le_bytes()).unwrap();
        cpu.boot_supervisor(RAM_BASE, 0);
        cpu.x[17] = 0x53525354; cpu.x[16] = 0; cpu.x[10] = reset_type; cpu.x[11] = 0;
        cpu.step().unwrap();
        assert!(cpu.stopped);
        assert_eq!(cpu.reset_requested, reset_type != 0);
    }
}
