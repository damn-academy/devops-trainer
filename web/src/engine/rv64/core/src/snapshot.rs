//! Versioned, eager single-hart checkpoint. Host network peers are external.
use crate::Cpu;
use bincode::Options;
const MAGIC: &[u8; 8] = b"DTRV64\0\x01";
impl Cpu {
    pub fn snapshot(&self) -> Result<Vec<u8>, String> {
        let mut out = MAGIC.to_vec();
        bincode::DefaultOptions::new().with_fixint_encoding()
            .serialize_into(&mut out, self).map_err(|e| e.to_string())?;
        Ok(out)
    }
    pub fn restore(&mut self, data: &[u8]) -> Result<(), String> {
        if !data.starts_with(MAGIC) { return Err("unsupported RV64 snapshot version".into()); }
        let mut restored: Cpu = bincode::DefaultOptions::new().with_fixint_encoding()
            .with_limit(data.len() as u64).reject_trailing_bytes()
            .deserialize(&data[8..]).map_err(|e| e.to_string())?;
        if restored.memory.ram.len() != self.memory.ram.len() || restored.pc & 1 != 0 || restored.x[0] != 0 {
            return Err("snapshot machine configuration mismatch".into());
        }
        restored.memory.reset_caches();
        *self = restored;
        Ok(())
    }
}

// Eager sparse RAM encoding; lazy page loading belongs to R3. Zero pages
// consume no payload, keeping cold-machine snapshots within browser memory.
pub(crate) mod ram {
    use serde::{Serialize, Deserialize, Serializer, Deserializer};
    pub fn serialize<S: Serializer>(ram: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
        let pages: Vec<(usize, &[u8])> = ram.chunks(4096).enumerate()
            .filter(|(_, bytes)| bytes.iter().any(|b| *b != 0)).collect();
        (ram.len(), pages).serialize(serializer)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
        let (size, pages): (usize, Vec<(usize, Vec<u8>)>) = Deserialize::deserialize(deserializer)?;
        if size > 1024 * 1024 * 1024 { return Err(serde::de::Error::custom("snapshot RAM exceeds limit")); }
        let mut ram = vec![0; size]; let mut previous = None;
        for (index, bytes) in pages {
            let start = index.checked_mul(4096).ok_or_else(|| serde::de::Error::custom("RAM page overflow"))?;
            if start >= size || bytes.len() != (size-start).min(4096) || previous.map_or(false, |p| index <= p) {
                return Err(serde::de::Error::custom("invalid snapshot RAM page"));
            }
            ram[start..start+bytes.len()].copy_from_slice(&bytes); previous = Some(index);
        }
        Ok(ram)
    }
}
