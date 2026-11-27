//! Versioned, eager single-hart checkpoint. Host network peers are external.
use crate::Cpu;
use bincode::Options;
const MAGIC: &[u8; 8] = b"DTRV64\0\x01";
/// SMP envelope: per-hart CPUs, the device CPU, control words and the shared
/// RAM page stream are assembled by the host; each Cpu blob carries this magic.
pub const MAGIC_SMP: &[u8; 8] = b"DTRV64\0\x03";
impl Cpu {
    pub fn snapshot(&mut self) -> Result<Vec<u8>, String> {
        self.memory.ensure_ram(0, self.memory.ram.len());
        self.encode_snapshot()
    }
    fn encode_snapshot(&self) -> Result<Vec<u8>, String> {
        if self.memory.shared_bytes != 0 { return Err("SMP requires an all-hart snapshot barrier and shared RAM image".into()); }
        self.encode_with(MAGIC)
    }
    fn encode_with(&self, magic: &[u8; 8]) -> Result<Vec<u8>, String> {
        let mut out = magic.to_vec();
        bincode::DefaultOptions::new().with_fixint_encoding()
            .serialize_into(&mut out, self).map_err(|e| e.to_string())?;
        Ok(out)
    }
    /// One quiesced SMP hart (or the shared device engine): full CPU state,
    /// no RAM — the host owns the shared image.
    pub fn smp_snapshot(&mut self) -> Result<Vec<u8>, String> {
        if self.memory.shared_bytes == 0 { return Err("not a shared CPU".into()); }
        let d = &mut self.memory.devices;
        let mut clean = std::collections::BTreeMap::new();
        for (index, bytes) in std::mem::take(&mut d.disk_chunks) {
            if d.disk_dirty.contains(&index) { d.disk_chunks.insert(index, bytes); }
            else { clean.insert(index, bytes); }
        }
        // v3 adds PLIC contexts for secondary harts without changing the
        // historical single-hart v1 encoding (those fields are serde-skipped).
        let mut out = MAGIC_SMP.to_vec();
        let result = bincode::DefaultOptions::new().with_fixint_encoding()
            .serialize_into(&mut out, &(&*self, self.memory.devices.extra_enable, self.memory.devices.extra_threshold))
            .map(|_| out).map_err(|e| e.to_string());
        self.memory.devices.disk_chunks.append(&mut clean);
        result
    }
    pub fn smp_restore(&mut self, data: &[u8]) -> Result<(), String> {
        if self.memory.shared_bytes == 0 { return Err("restore target is not a shared CPU".into()); }
        if !data.starts_with(MAGIC_SMP) { return Err("unsupported RV64 SMP CPU blob".into()); }
        let (mut restored, enable, threshold): (Cpu, [u32; 6], [u32; 6]) = bincode::DefaultOptions::new().with_fixint_encoding()
            .with_limit(data.len() as u64).reject_trailing_bytes()
            .deserialize(&data[8..]).map_err(|e| e.to_string())?;
        if restored.pc & 1 != 0 || restored.x[0] != 0 {
            return Err("SMP machine configuration mismatch".into());
        }
        // Per-hart blobs carry unused private device/queue state; only the
        // device engine's blob is authoritative, and caches are always rebuilt.
        // Shared geometry is a property of the restoring runtime, not the blob:
        // shared_bytes is never serialized (see Memory), so adopt ours.
        restored.memory.shared_bytes = self.memory.shared_bytes;
        restored.memory.devices.extra_enable = enable;
        restored.memory.devices.extra_threshold = threshold;
        restored.memory.devices.disk_dirty = restored.memory.devices.disk_chunks.keys().copied().collect();
        restored.reservation = None;
        restored.memory.reset_caches();
        *self = restored;
        Ok(())
    }
    pub fn restore(&mut self, data: &[u8]) -> Result<(), String> {
        if !data.starts_with(MAGIC) { return Err("unsupported RV64 snapshot version".into()); }
        let mut restored: Cpu = bincode::DefaultOptions::new().with_fixint_encoding()
            .with_limit(data.len() as u64).reject_trailing_bytes()
            .deserialize(&data[8..]).map_err(|e| e.to_string())?;
        if restored.memory.ram.len() != self.memory.ram.len() || restored.pc & 1 != 0 || restored.x[0] != 0 {
            return Err("snapshot machine configuration mismatch".into());
        }
        restored.memory.devices.disk_dirty = restored.memory.devices.disk_chunks.keys().copied().collect();
        restored.memory.reset_caches();
        *self = restored;
        Ok(())
    }
    /// Same CPU/device encoding as v1, with RAM externalized and immutable
    /// HTTP disk cache dropped. Dirty disk chunks remain part of metadata.
    pub fn snapshot_metadata(&mut self) -> Result<Vec<u8>, String> {
        let ram = std::mem::take(&mut self.memory.ram);
        let mut clean = std::collections::BTreeMap::new();
        let d = &mut self.memory.devices;
        let all = std::mem::take(&mut d.disk_chunks);
        for (i, chunk) in all {
            if d.disk_dirty.contains(&i) { d.disk_chunks.insert(i, chunk); }
            else { clean.insert(i, chunk); }
        }
        let result = self.encode_snapshot();
        self.memory.ram = ram;
        self.memory.devices.disk_chunks.append(&mut clean);
        result
    }
    pub fn restore_paged(&mut self, metadata: &[u8], present: &[u8]) -> Result<(), String> {
        let size = self.memory.ram.len();
        if present.len() != (size + 262143) / 262144 || present.iter().any(|b| *b > 1) {
            return Err("invalid lazy RAM bitmap".into());
        }
        let mut restored = Cpu::new(0);
        restored.restore(metadata)?;
        // Validation completed before touching the running machine.
        restored.memory.ram = std::mem::take(&mut self.memory.ram);
        restored.memory.ram.fill(0);
        restored.memory.lazy_ram = present.iter().map(|b| *b != 0).collect();
        restored.memory.reset_caches();
        *self = restored;
        Ok(())
    }

}

// Legacy eager sparse encoding. Paged checkpoints externalize RAM through
// snapshot_metadata; zero pages consume no payload in either representation.
pub(crate) mod ram {
    use serde::{Serialize, Serializer, Deserializer};
    pub fn serialize<S: Serializer>(ram: &[u8], serializer: S) -> Result<S::Ok, S::Error> {
        let pages: Vec<(usize, &[u8])> = ram.chunks(4096).enumerate()
            .filter(|(_, bytes)| bytes.iter().any(|b| *b != 0)).collect();
        (ram.len(), pages).serialize(serializer)
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
        use serde::de::{DeserializeSeed, Error, SeqAccess, Visitor};
        struct Pages<'a>(&'a mut [u8]);
        impl<'de> DeserializeSeed<'de> for Pages<'_> {
            type Value = ();
            fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
                struct PageVisitor<'a>(&'a mut [u8]);
                impl<'de> Visitor<'de> for PageVisitor<'_> {
                    type Value = ();
                    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result { f.write_str("ordered nonzero RAM pages") }
                    fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<(), A::Error> {
                        let mut previous = None;
                        while let Some((index, bytes)) = seq.next_element::<(usize, Vec<u8>)>()? {
                            let start = index.checked_mul(4096).ok_or_else(|| A::Error::custom("RAM page overflow"))?;
                            if start >= self.0.len() || bytes.len() != (self.0.len()-start).min(4096) || previous.map_or(false, |p| index <= p) {
                                return Err(A::Error::custom("invalid snapshot RAM page"));
                            }
                            self.0[start..start+bytes.len()].copy_from_slice(&bytes); previous = Some(index);
                        }
                        Ok(())
                    }
                }
                d.deserialize_seq(PageVisitor(self.0))
            }
        }
        struct RamVisitor;
        impl<'de> Visitor<'de> for RamVisitor {
            type Value = Vec<u8>;
            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result { f.write_str("RAM size and sparse pages") }
            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Vec<u8>, A::Error> {
                let size: usize = seq.next_element()?.ok_or_else(|| A::Error::custom("missing RAM size"))?;
                if size > 1024 * 1024 * 1024 { return Err(A::Error::custom("snapshot RAM exceeds limit")); }
                let mut ram = vec![0; size];
                seq.next_element_seed(Pages(&mut ram))?.ok_or_else(|| A::Error::custom("missing RAM pages"))?;
                Ok(ram)
            }
        }
        // Decode directly into RAM: retaining Vec<Vec<page>> would duplicate
        // nearly the entire guest working set during a Ready-node restore.
        deserializer.deserialize_tuple(2, RamVisitor)
    }
}

#[cfg(test)]
mod tests {
    use bincode::Options;
    #[derive(serde::Serialize, serde::Deserialize)]
    struct Ram(#[serde(with = "super::ram")] Vec<u8>);
    #[test]
    fn streaming_ram_preserves_v1_bytes_and_rejects_bad_page_order() {
        let options = bincode::DefaultOptions::new().with_fixint_encoding();
        let legacy = (8192usize, vec![(1usize, vec![7u8; 4096])]);
        let bytes = options.serialize(&legacy).unwrap();
        let restored: Ram = options.deserialize(&bytes).unwrap();
        assert_eq!(restored.0[..4096], [0;4096]);
        assert_eq!(options.serialize(&restored).unwrap(), bytes);
        for pages in [vec![(1usize, vec![7u8;4096]), (0, vec![8;4096])], vec![(0,vec![7;4096]),(0,vec![8;4096])], vec![(2,vec![7;4096])], vec![(0,vec![7;4095])]] {
            assert!(options.deserialize::<Ram>(&options.serialize(&(8192usize,pages)).unwrap()).is_err());
        }
    }
}
