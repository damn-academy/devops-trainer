use rv64_core::{Access, Cpu, Memory, Mode, RAM_BASE};
fn put(m: &mut Memory, a: u64, v: u64) {
    m.physical_write(a, 8, v).unwrap()
}
fn mapping() -> (Memory, u64) {
    let mut m = Memory::new(0x10000);
    m.pmpcfg[0] = 0x1f; m.pmpaddr[0] = (1 << 54) - 1;
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

#[test]
fn decode_cache_observes_code_writes_and_image_replacement() {
    let mut c = Cpu::new(8192);
    c.memory.load_image(RAM_BASE, &0x00100513u32.to_le_bytes()).unwrap();
    c.step().unwrap();
    assert_eq!(c.x[10], 1);
    c.pc = RAM_BASE;
    c.memory.physical_write(RAM_BASE, 4, 0x00200513).unwrap();
    c.step().unwrap();
    assert_eq!(c.x[10], 2);
    c.pc = RAM_BASE;
    c.memory.load_image(RAM_BASE, &0x00300513u32.to_le_bytes()).unwrap();
    c.step().unwrap();
    assert_eq!(c.x[10], 3);
}

#[test]
fn snapshot_restores_cpu_memory_devices_and_rejects_truncation() {
    let mut c = Cpu::new(8192);
    c.memory.load_image(RAM_BASE, &0x00150513u32.to_le_bytes()).unwrap();
    c.x[10] = 40; c.f[3] = 0x12345678; c.csr[0x340] = 123;
    c.memory.devices.input.extend(b"pending");
    c.memory.devices.net_rx.push_back(vec![1, 2, 3]);
    c.memory.devices.disk = vec![9; 512];
    c.memory.mtimecmp = 123456; c.time(12345);
    let state = c.snapshot().unwrap();
    c.step().unwrap(); assert_eq!(c.x[10], 41);
    c.memory.devices.input.clear(); c.memory.devices.disk[0] = 0;
    c.restore(&state).unwrap();
    assert_eq!(c.pc, RAM_BASE); assert_eq!(c.f[3], 0x12345678);
    assert_eq!(c.csr[0x340], 123); assert_eq!(c.memory.time, 12345);
    assert_eq!(c.memory.devices.input.len(), 7);
    assert_eq!(c.memory.devices.disk[0], 9);
    assert_eq!(c.memory.devices.net_rx[0], vec![1, 2, 3]);
    c.step().unwrap(); assert_eq!(c.x[10], 41);
    assert!(c.restore(&state[..state.len()-1]).is_err());
    assert_eq!(c.x[10], 41); // Failed restores are atomic.
}

#[test]
fn lazy_disk_chunks_are_bounded_and_preserve_overlay() {
    let mut d = rv64_core::devices::Devices::default();
    d.disk_bytes = 512;
    assert!(d.disk_chunk(1, vec![0; 512]).is_err());
    assert!(d.disk_chunk(0, vec![0; 511]).is_err());
    d.disk_chunk(0, vec![7; 512]).unwrap();
    d.disk_chunks.get_mut(&0).unwrap()[0] = 42;
    d.disk_chunk(0, vec![8; 512]).unwrap();
    assert_eq!(d.disk_chunks[&0][0], 42);
}

#[test]
fn pmp_priority_partial_access_lock_and_mprv() {
    let mut c = Cpu::new(8192);
    c.write_csr(0x3b0, (RAM_BASE + 4) >> 2).unwrap();
    c.write_csr(0x3a0, 0x91).unwrap(); // locked NA4 read-only
    assert!(c.memory.pmp_check(RAM_BASE, 8, Access::Read, Mode::M).is_err());
    assert!(c.memory.pmp_check(RAM_BASE + 4, 4, Access::Read, Mode::M).is_ok());
    assert!(c.memory.pmp_check(RAM_BASE + 4, 4, Access::Write, Mode::M).is_err());
    c.write_csr(0x3b0, 0).unwrap(); c.write_csr(0x3a0, 0).unwrap();
    assert_eq!(c.read_csr(0x3b0).unwrap(), (RAM_BASE+4)>>2);
    assert_eq!(c.read_csr(0x3a0).unwrap(), 0x91);
    c.csr[0x300] = (1 << 17) | (1 << 11);
    assert_eq!(c.load(RAM_BASE + 8, 4, Access::Read).unwrap_err().cause, 5);
    assert!(c.memory.pmp_check(RAM_BASE + 8, 4, Access::Read, Mode::M).is_ok());
    assert!(c.read_csr(0x3a1).is_err());
}

fn queue(c: &mut Cpu, base: u64, qi: u32, descriptors: &[(u64, u32, u16)]) -> (u64, u64) {
    let desc = RAM_BASE + 0x1000; let avail = RAM_BASE+0x2000; let used = RAM_BASE+0x3000;
    for (i, &(addr, len, flags)) in descriptors.iter().enumerate() {
        put(&mut c.memory, desc+i as u64*16, addr);
        put(&mut c.memory, desc+i as u64*16+8, len as u64 | ((flags as u64)<<32) | (((i+1) as u64)<<48));
    }
    put(&mut c.memory, avail, 1<<16);
    for (off, v) in [(0x24,1),(0x20,1),(0x70,15),(0x30,qi),(0x38,8),(0x80,desc as u32),(0x90,avail as u32),(0xa0,used as u32),(0x44,1)] { c.memory.devices.write(base+off,v); }
    (avail, used)
}
#[test]
fn lazy_virtio_block_defers_completion_then_restores_pending_request() {
    let mut c = Cpu::new(0x10000); c.memory.devices.disk_bytes = 512;
    let h=RAM_BASE+0x4000; let data=RAM_BASE+0x5000; let status=RAM_BASE+0x6000;
    let (_,used)=queue(&mut c,0x10000000,0,&[(h,16,1),(data,512,3),(status,1,2)]);
    c.service_devices(); assert_eq!(c.memory.devices.disk_missing,vec![0]);
    assert_eq!(c.memory.physical_read(used+2,2,Access::Read).unwrap(),0);
    let state=c.snapshot().unwrap(); c.restore(&state).unwrap();
    c.memory.devices.disk_missing.clear(); c.memory.devices.disk_chunk(0,vec![42;512]).unwrap();
    c.service_devices();
    assert_eq!(c.memory.physical_read(data,1,Access::Read).unwrap(),42);
    assert_eq!(c.memory.physical_read(used+2,2,Access::Read).unwrap(),1);
    assert_eq!(c.memory.physical_read(status,1,Access::Read).unwrap(),0);
}
#[test]
fn virtio_block_one_mib_request_includes_header_and_status() {
    let mut c = Cpu::new(2 * 1024 * 1024);
    c.memory.devices.disk = vec![0x5a; 1024 * 1024];
    let h = RAM_BASE + 0x4000;
    let status = RAM_BASE + 0x5000;
    let data = RAM_BASE + 0x10000;
    let (_, used) = queue(&mut c, 0x10000000, 0,
        &[(h, 16, 1), (data, 1024 * 1024, 3), (status, 1, 2)]);
    c.service_devices();
    assert_eq!(c.memory.devices.read(0x10000070).unwrap() & 64, 0);
    assert_eq!(c.memory.physical_read(used + 2, 2, Access::Read).unwrap(), 1);
    assert_eq!(c.memory.physical_read(status, 1, Access::Read).unwrap(), 0);
    assert_eq!(c.memory.physical_read(data + 1024 * 1024 - 1, 1, Access::Read).unwrap(), 0x5a);
}
#[test]
fn virtio_rng_and_network_receive() {
    for (base, data) in [(0x10003000,vec![1,2,3]),(0x10001000,vec![4,5,6])] {
        let mut c=Cpu::new(0x10000); let buf=RAM_BASE+0x4000;
        queue(&mut c,base,0,&[(buf,64,2)]);
        let offset=if base==0x10003000 { c.memory.devices.entropy.extend(&data); 0 } else { c.memory.devices.net_rx.push_back(data.clone()); 12 };
        c.service_devices();
        for (i,b) in data.iter().enumerate() { assert_eq!(c.memory.physical_read(buf+offset+i as u64,1,Access::Read).unwrap(),*b as u64); }
    }
}
#[test]
fn clint_split_registers() {
    let mut m=Memory::new(4096);
    for base in [0x02004000,0x0200bff8] {
        m.physical_write(base,4,0x76543210).unwrap(); m.physical_write(base+4,4,0xfedcba98).unwrap();
        assert_eq!(m.physical_read(base,8,Access::Read).unwrap(),0xfedcba9876543210);
        assert_eq!(m.physical_read(base+4,4,Access::Read).unwrap(),0xfedcba98);
    }
}

#[test]
fn writable_mtime_keeps_host_delta_and_snapshot_clock() {
    let mut c = Cpu::new(4096); c.time(1000);
    c.memory.physical_write(0x0200bff8,8,10).unwrap();
    c.time(1010); assert_eq!(c.memory.time,20);
    let snapshot=c.snapshot().unwrap(); c.time(2000); c.restore(&snapshot).unwrap();
    c.time(1020); assert_eq!(c.memory.time,30);
}
#[test]
fn mmio_rejects_invalid_widths_without_writes() {
    let mut c=Cpu::new(4096);
    assert_eq!(c.load(0x10000000,8,Access::Read).unwrap_err().cause,5);
    assert_eq!(c.store(0x10000070,1,15).unwrap_err().cause,7);
    assert_eq!(c.memory.devices.read(0x10000070),Some(0));
}
#[test]
fn locked_tor_also_locks_previous_address_and_pmp_changes_flush_tlb() {
    let mut c=Cpu::new(0x10000);
    c.write_csr(0x3b0, RAM_BASE>>2).unwrap();
    c.write_csr(0x3b1,(RAM_BASE+4096)>>2).unwrap();
    c.write_csr(0x3a0,0x8f00).unwrap();
    c.write_csr(0x3b0,0).unwrap();
    assert_eq!(c.read_csr(0x3b0).unwrap(),RAM_BASE>>2);
    assert!(c.memory.pmp_check(RAM_BASE,4096,Access::Write,Mode::S).is_ok());
    assert!(c.memory.pmp_check(RAM_BASE+4096,1,Access::Read,Mode::S).is_err());
    let (m,satp)=mapping(); c.memory=m; c.mode=Mode::M;
    c.memory.translate_size(0,8,Access::Read,Mode::U,satp,0).unwrap();
    c.write_csr(0x3a0,0).unwrap();
    assert!(c.memory.translate_size(0,8,Access::Read,Mode::U,satp,0).is_err());
}

#[test]
fn physical_addresses_do_not_wrap_to_wasm32_ram() {
    let mut m=Memory::new(4096);
    let high=RAM_BASE+(1u64<<32);
    assert!(m.physical_read(high,4,Access::Read).is_err());
    assert!(m.physical_write(high,4,1).is_err());
    assert!(m.load_image(high,&[1]).is_err());
    assert_eq!(m.physical_read(RAM_BASE,4,Access::Read).unwrap(),0);
}

#[test]
fn reviewed_status_timer_and_adue_controls() {
    let mut c=Cpu::new(0x10000);
    c.write_csr(0x300,(3<<13)|(1<<36)|(1<<37)|(1<<6)).unwrap();
    assert_eq!(c.read_csr(0x300).unwrap()>>63,1);
    assert_eq!(c.read_csr(0x300).unwrap()&((1<<36)|(1<<37)|(1<<6)),0);
    c.write_csr(0x100,1<<63).unwrap();
    assert_eq!(c.read_csr(0x100).unwrap()>>63,0);
    c.write_csr(0x30a,(1<<63)|(1<<61)).unwrap(); c.time(100);
    c.write_csr(0x14d,200).unwrap(); c.write_csr(0x344,32).unwrap();
    assert_eq!(c.read_csr(0x344).unwrap()&32,0);
    c.write_csr(0x14d,0).unwrap(); c.write_csr(0x344,0).unwrap();
    assert_eq!(c.read_csr(0x344).unwrap()&32,32);
    let (m,s)=mapping(); c.memory=m;
    c.write_csr(0x30a,0).unwrap();
    assert_eq!(c.memory.translate(0,Access::Read,Mode::U,s,0).unwrap_err().cause,13);
    c.write_csr(0x30a,1<<61).unwrap();
    assert!(c.memory.translate(0,Access::Read,Mode::U,s,0).is_ok());
}
#[test]
fn minstret_write_suppresses_itself_only_and_trace_reports_raw() {
    let mut c=Cpu::new(4096); c.trace_enabled=true; c.x[1]=100;
    c.memory.load_image(RAM_BASE,&[0x73,0x90,0x20,0xb0,0x13,0,0,0]).unwrap(); // csrw minstret,x1; nop
    c.step().unwrap(); assert_eq!(c.retired,100);
    assert!(matches!(c.last_trace,Some(rv64_core::cpu::TraceEvent::Instruction{raw:0xb0209073,..})));
    c.step().unwrap(); assert_eq!(c.retired,101);
    c.pc=RAM_BASE+4; c.write_csr(0xb02,200).unwrap(); c.step().unwrap(); assert_eq!(c.retired,201);
}
#[test]
fn virtio_feature_config_flush_and_suppressed_interrupt() {
    let mut c=Cpu::new(0x10000); c.memory.devices.disk=vec![0;512];
    assert_eq!(c.memory.devices.read(0x10000010),Some((1<<2)|(1<<6)|(1<<9)));
    assert_eq!(c.memory.devices.read(0x1000000c),Some(0x4454524e));
    assert_eq!(c.memory.devices.read(0x1000010c),Some(126));
    assert_eq!(c.memory.devices.read(0x10000114),Some(512));
    assert_eq!(c.memory.devices.read(0x10001010),Some((1<<5)|(1<<16)));
    assert_eq!(c.memory.devices.read(0x10001104).unwrap()>>16,1);
    let h=RAM_BASE+0x4000; let status=RAM_BASE+0x5000;
    put(&mut c.memory,h,4); // FLUSH
    let (avail,used)=queue(&mut c,0x10000000,0,&[(h,16,1),(status,1,2)]);
    c.memory.physical_write(avail,2,1).unwrap(); c.service_devices();
    assert_eq!(c.memory.physical_read(status,1,Access::Read).unwrap(),0);
    assert_eq!(c.memory.physical_read(used+2,2,Access::Read).unwrap(),1);
    assert_eq!(c.memory.devices.read(0x10000060),Some(0));
}
#[test]
fn modern_net_header_has_one_buffer_and_preserves_ethernet() {
    let mut c=Cpu::new(0x10000); let buf=RAM_BASE+0x4000;
    queue(&mut c,0x10001000,0,&[(buf,64,2)]);
    c.memory.devices.net_rx.push_back(vec![0xab;14]); c.service_devices();
    assert_eq!(c.memory.physical_read(buf+10,2,Access::Read).unwrap(),1);
    assert_eq!(c.memory.physical_read(buf+12,1,Access::Read).unwrap(),0xab);
}
#[test]
fn plic_claim_ignores_threshold_and_clears_pending() {
    let mut c=Cpu::new(0x10000); let buf=RAM_BASE+0x4000;
    queue(&mut c,0x10003000,0,&[(buf,1,2)]); c.memory.devices.entropy.push_back(1);
    c.memory.devices.write(0xc000010,1); c.memory.devices.write(0xc002080,16);
    c.memory.devices.write(0xc201000,7); c.service_devices();
    assert_eq!(c.csr[0x344]&(1<<9),0);
    assert_eq!(c.memory.devices.read(0xc201004),Some(4));
    assert_eq!(c.memory.devices.read(0xc001000).unwrap()&16,0);
}

#[test]
fn review_counterexamples_and_boot_contract() {
    let mut c=Cpu::new(4096); c.boot_supervisor(RAM_BASE,0);
    assert_eq!(c.csr[0x30a]&1,0); assert_eq!((c.csr[0x300]>>11)&3,1);
    c.csr[0x306]=0; assert!(c.read_csr(0x14d).is_err());
    c.csr[0x306]=2; assert!(c.read_csr(0x14d).is_ok());
    c.mode=Mode::M;
    c.write_csr(0x3b0,RAM_BASE>>2).unwrap(); c.write_csr(0x3b1,(RAM_BASE+4)>>2).unwrap();
    c.write_csr(0x3a0,0x8800).unwrap(); c.write_csr(0x3b0,0).unwrap();
    assert_eq!(c.read_csr(0x3b0).unwrap(),RAM_BASE>>2); // Locked TOR without R/W/X.
    assert!(c.read_csr(0x7a0).is_err());
    c.write_csr(0x305,0x123).unwrap(); assert_eq!(c.read_csr(0x305).unwrap()&3,1);
    let mut j=Cpu::new(4096); j.x[1]=RAM_BASE+9;
    j.memory.load_image(RAM_BASE,&0x000080e7u32.to_le_bytes()).unwrap(); // jalr ra,0(ra)
    j.step().unwrap(); assert_eq!(j.pc,RAM_BASE+8); assert_eq!(j.x[1],RAM_BASE+4);
}

#[test]
fn virtio_configuration_supports_linux_mac_byte_reads() {
    let mut c=Cpu::new(4096);
    c.memory.devices.mac=[2,3,4,5,6,7];
    for i in 0..6 { assert_eq!(c.load(0x10001100+i,1,Access::Read).unwrap(),i+2); }
    assert_eq!(c.load(0x10001106,2,Access::Read).unwrap(),1);
    assert_eq!(c.load(0x10001000,1,Access::Read).unwrap_err().cause,5);
}
