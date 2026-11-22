//! Flattened device tree writer for the single-hart and experimental SMP engines.
use crate::RAM_BASE;
struct Fdt {
    structure: Vec<u8>,
    strings: Vec<u8>,
}
impl Fdt {
    fn word(&mut self, v: u32) {
        self.structure.extend_from_slice(&v.to_be_bytes())
    }
    fn begin(&mut self, name: &str) {
        self.word(1);
        self.structure.extend_from_slice(name.as_bytes());
        self.structure.push(0);
        self.pad();
    }
    fn end(&mut self) {
        self.word(2)
    }
    fn pad(&mut self) {
        while self.structure.len() % 4 != 0 {
            self.structure.push(0)
        }
    }
    fn prop(&mut self, name: &str, data: &[u8]) {
        let off = self.strings.len() as u32;
        self.strings.extend_from_slice(name.as_bytes());
        self.strings.push(0);
        self.word(3);
        self.word(data.len() as u32);
        self.word(off);
        self.structure.extend_from_slice(data);
        self.pad();
    }
    fn num(&mut self, name: &str, values: &[u32]) {
        self.prop(
            name,
            &values
                .iter()
                .flat_map(|n| n.to_be_bytes())
                .collect::<Vec<_>>(),
        )
    }
    fn text(&mut self, name: &str, value: &str) {
        let mut v = value.as_bytes().to_vec();
        v.push(0);
        self.prop(name, &v)
    }
}
pub fn build(ram_size: u64, initrd_start: u64, initrd_len: u64, cmdline: &str) -> Vec<u8> {
    build_harts(ram_size, initrd_start, initrd_len, cmdline, 1)
}
/// Caller must provide matching HSM, PLIC/CLINT contexts and shared RAM before
/// advertising more than one hart to Linux.
pub fn build_harts(ram_size: u64, initrd_start: u64, initrd_len: u64, cmdline: &str, harts: u32) -> Vec<u8> {
    assert!((1..=64).contains(&harts));
    let plic_handle = harts + 1;
    let mut f = Fdt {
        structure: Vec::new(),
        strings: Vec::new(),
    };
    f.begin("");
    f.num("#address-cells", &[2]);
    f.num("#size-cells", &[2]);
    f.text("compatible", "devops-trainer,rv64");
    f.text("model", if harts == 1 { "RV64 R1 single hart" } else { "RV64 R3 SMP" });
    f.begin("chosen");
    f.text("bootargs", cmdline);
    f.text("stdout-path", "/soc/virtio@10002000");
    f.num(
        "linux,initrd-start",
        &[(initrd_start >> 32) as u32, initrd_start as u32],
    );
    let end = initrd_start + initrd_len;
    f.num("linux,initrd-end", &[(end >> 32) as u32, end as u32]);
    f.end();
    f.begin("memory@80000000");
    f.text("device_type", "memory");
    f.num(
        "reg",
        &[0, RAM_BASE as u32, (ram_size >> 32) as u32, ram_size as u32],
    );
    f.end();
    f.begin("cpus");
    f.num("#address-cells", &[1]);
    f.num("#size-cells", &[0]);
    f.num("timebase-frequency", &[10_000_000]);
    for hart in 0..harts {
        f.begin(&format!("cpu@{hart:x}"));
        f.num("reg", &[hart]);
        f.text("device_type", "cpu");
        f.text("compatible", "riscv");
        f.text("status", "okay");
        f.text(
            "riscv,isa",
            "rv64imafdc_zicsr_zifencei_zicntr_zba_zbb_zbs_sstc_svadu",
        );
        f.text("riscv,isa-base", "rv64i");
        f.prop("riscv,isa-extensions", b"i\0m\0a\0f\0d\0c\0zicsr\0zifencei\0zicntr\0zba\0zbb\0zbs\0sstc\0svadu\0");
        f.prop("riscv,has-stimecmp", &[]);
        f.text("mmu-type", "riscv,sv39");
        f.begin("interrupt-controller");
        f.num("#interrupt-cells", &[1]);
        f.prop("interrupt-controller", &[]);
        f.text("compatible", "riscv,cpu-intc");
        f.num("phandle", &[hart + 1]);
        f.end();
        f.end();
    }
    f.end();
    f.begin("soc");
    f.num("#address-cells", &[2]);
    f.num("#size-cells", &[2]);
    f.text("compatible", "simple-bus");
    f.prop("ranges", &[]);
    f.begin("clint@2000000");
    f.text("compatible", "riscv,clint0");
    // SMP timers/IPIs are supplied by SBI/SSTC; the legacy MMIO CLINT is
    // single-hart only. Do not advertise a usable multi-hart MMIO device.
    if harts > 1 { f.text("status", "disabled"); }
    f.num("reg", &[0, 0x02000000, 0, 0x10000]);
    let clint: Vec<u32> = (1..=harts).flat_map(|h| [h, 3, h, 7]).collect();
    f.num("interrupts-extended", &clint);
    f.end();
    f.begin("plic@c000000");
    f.text("compatible", "riscv,plic0");
    f.num("reg", &[0, 0xc000000, 0, 0x4000000]);
    f.num("#interrupt-cells", &[1]);
    f.prop("interrupt-controller", &[]);
    f.num("riscv,ndev", &[31]);
    f.num("riscv,max-priority", &[7]);
    f.num("phandle", &[plic_handle]);
    let contexts: Vec<u32> = (1..=harts).flat_map(|h| [h, 11, h, 9]).collect();
    f.num("interrupts-extended", &contexts);
    f.end();
    for j in 0..4 {
        let addr = 0x10000000 + j * 0x1000;
        f.begin(&format!("virtio@{addr:x}"));
        f.text("compatible", "virtio,mmio");
        f.prop("dma-coherent", &[]);
        f.num("reg", &[0, addr, 0, 0x1000]);
        f.num("interrupt-parent", &[plic_handle]);
        f.num("interrupts", &[j + 1]);
        f.end();
    }
    f.end();
    f.end();
    f.word(9);
    let reserve = 40;
    let structure = reserve + 16;
    let strings = structure + f.structure.len();
    let size = strings + f.strings.len();
    let mut out = Vec::new();
    for v in [
        0xd00dfeed,
        size as u32,
        structure as u32,
        strings as u32,
        reserve as u32,
        17,
        16,
        0,
        f.strings.len() as u32,
        f.structure.len() as u32,
    ] {
        out.extend_from_slice(&v.to_be_bytes());
    }
    out.extend_from_slice(&[0; 16]);
    out.extend(f.structure);
    out.extend(f.strings);
    out
}
