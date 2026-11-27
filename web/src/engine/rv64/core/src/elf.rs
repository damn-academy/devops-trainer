//! Test-tool ELF64 loader. Inputs must be trusted upstream test binaries.
use crate::Cpu;
fn u16le(b: &[u8], n: usize) -> usize {
    u16::from_le_bytes(b[n..n + 2].try_into().unwrap()) as usize
}
fn u32le(b: &[u8], n: usize) -> usize {
    u32::from_le_bytes(b[n..n + 4].try_into().unwrap()) as usize
}
fn u64le(b: &[u8], n: usize) -> u64 {
    u64::from_le_bytes(b[n..n + 8].try_into().unwrap())
}
pub fn load(cpu: &mut Cpu, b: &[u8]) -> std::collections::BTreeMap<String, u64> {
    assert_eq!(&b[0..6], b"\x7fELF\x02\x01");
    assert_eq!(u16le(b, 18), 243);
    cpu.pc = u64le(b, 24);
    let ph = u64le(b, 32) as usize;
    for n in 0..u16le(b, 56) {
        let p = ph + n * u16le(b, 54);
        if u32le(b, p) == 1 {
            let off = u64le(b, p + 8) as usize;
            let size = u64le(b, p + 32) as usize;
            cpu.memory
                .load_image(u64le(b, p + 24), &b[off..off + size])
                .unwrap();
        }
    }
    let mut symbols = std::collections::BTreeMap::new();
    let sh = u64le(b, 40) as usize;
    let stride = u16le(b, 58);
    for n in 0..u16le(b, 60) {
        let s = sh + n * stride;
        if u32le(b, s + 4) != 2 {
            continue;
        }
        let strtab = sh + u32le(b, s + 40) * stride;
        let strings = u64le(b, strtab + 24) as usize;
        let start = u64le(b, s + 24) as usize;
        let len = u64le(b, s + 32) as usize;
        let step = u64le(b, s + 56) as usize;
        for t in (start..start + len).step_by(step) {
            let name = strings + u32le(b, t);
            let end = b[name..].iter().position(|v| *v == 0).unwrap() + name;
            if let Ok(name) = std::str::from_utf8(&b[name..end]) {
                symbols.insert(name.to_owned(), u64le(b, t + 8));
            }
        }
    }
    symbols
}
