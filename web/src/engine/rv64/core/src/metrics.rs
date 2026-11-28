//! Non-architectural counters, excluded from snapshots. TLB requests cover Rust paths only.
#[derive(Default)]
pub struct Metrics {
    pub inline_loads: u64,
    pub inline_stores: u64,
    pub smp_inline_loads: u64,
    pub smp_inline_stores: u64,
    pub smp_jit_chains: u64,

    pub jit_lookups: u64,
    pub jit_context_hits: u64,
    pub jit_code_reuse: u64,
    pub jit_dispatches: u64,
    pub jit_chains: u64,
    pub jit_pending: u64,
    pub jit_cold: u64,
    pub jit_queue_full: u64,
    pub jit_cache_clears: u64,
    pub jit_cache_evictions: u64,
    pub store_code_pages: u64,
    pub dma_code_pages: u64,
    pub tlb_flushes: u64,
    pub fence_i: u64,
    pub sfence_vma: u64,
    pub satp_changes: u64,
    pub sbi_fences: u64,
    pub remote_fence_i: u64,
    pub remote_sfence_vma: u64,
    pub remote_ipis: u64,
    pub shared_generation_changes: u64,
    pub inline_tlb_checks: u64,
    pub inline_tlb_misses: u64,
    pub tlb_requests: u64,
    pub tlb_walks: u64,
    pub mmio: u64,
    pub sbi_ecalls: u64,
    pub atomic_helpers: u64,
    pub fp_helpers: u64,
    pub memory_helpers: u64,
    pub interpreter_retired: u64,
    pub exceptions: [u64; 16],
    pub interrupts: [u64; 16],
}
impl Metrics {
    pub fn json(&self) -> String {
        let mut fields = Vec::new();
        fields.push(format!("\"inline_loads\":{}", self.inline_loads));
        fields.push(format!("\"inline_stores\":{}", self.inline_stores));
        fields.push(format!("\"smp_inline_loads\":{}", self.smp_inline_loads));
        fields.push(format!("\"smp_inline_stores\":{}", self.smp_inline_stores));
        fields.push(format!("\"smp_jit_chains\":{}", self.smp_jit_chains));

        fields.push(format!("\"remote_fence_i\":{}", self.remote_fence_i));
        fields.push(format!("\"remote_sfence_vma\":{}", self.remote_sfence_vma));
        fields.push(format!("\"remote_ipis\":{}", self.remote_ipis));
        fields.push(format!("\"shared_generation_changes\":{}", self.shared_generation_changes));
        // Remote instruction fences are serviced events, not invalidations.
        // Events, not discarded-block counts. Shared generations include writes
        // from other harts and DMA; they cannot be attributed by the reader.
        fields.push(format!("\"invalidations\":{{\"remote_fence_i\":{},\"explicit_clear\":{},\"evicted_blocks\":{},\"store_code_pages\":{},\"dma_code_pages\":{},\"shared_generation_changes\":{},\"translation_flushes\":{}}}",
            0, self.jit_cache_clears, self.jit_cache_evictions,
            self.store_code_pages, self.dma_code_pages, self.shared_generation_changes, self.tlb_flushes));
        fields.push(format!("\"jit_chains\":{}", self.jit_chains));
        fields.push(format!("\"jit_cache_evictions\":{}", self.jit_cache_evictions));
        fields.push(format!("\"inline_tlb_checks\":{}", self.inline_tlb_checks));
        fields.push(format!("\"inline_tlb_misses\":{}", self.inline_tlb_misses));
        fields.push(format!("\"jit_lookups\":{}", self.jit_lookups));
        fields.push(format!("\"jit_context_hits\":{}", self.jit_context_hits));
        fields.push(format!("\"jit_code_reuse\":{}", self.jit_code_reuse));
        fields.push(format!("\"jit_dispatches\":{}", self.jit_dispatches));
        fields.push(format!("\"jit_pending\":{}", self.jit_pending));
        fields.push(format!("\"jit_cold\":{}", self.jit_cold));
        fields.push(format!("\"jit_queue_full\":{}", self.jit_queue_full));
        fields.push(format!("\"jit_cache_clears\":{}", self.jit_cache_clears));
        fields.push(format!("\"store_code_pages\":{}", self.store_code_pages));
        fields.push(format!("\"dma_code_pages\":{}", self.dma_code_pages));
        fields.push(format!("\"tlb_flushes\":{}", self.tlb_flushes));
        fields.push(format!("\"fence_i\":{}", self.fence_i));
        fields.push(format!("\"sfence_vma\":{}", self.sfence_vma));
        fields.push(format!("\"satp_changes\":{}", self.satp_changes));
        fields.push(format!("\"sbi_fences\":{}", self.sbi_fences));
        fields.push(format!("\"tlb_requests\":{}", self.tlb_requests));
        fields.push(format!("\"tlb_walks\":{}", self.tlb_walks));
        fields.push(format!("\"mmio\":{}", self.mmio));
        fields.push(format!("\"sbi_ecalls\":{}", self.sbi_ecalls));
        fields.push(format!("\"atomic_helpers\":{}", self.atomic_helpers));
        fields.push(format!("\"fp_helpers\":{}", self.fp_helpers));
        fields.push(format!("\"memory_helpers\":{}", self.memory_helpers));
        fields.push(format!("\"interpreter_retired\":{}", self.interpreter_retired));
        fields.push(format!("\"exceptions\":{:?}", self.exceptions));
        fields.push(format!("\"interrupts\":{:?}", self.interrupts));
        format!("{{{}}}", fields.join(","))
    }
}

#[cfg(test)]
mod tests {
    use super::Metrics;

    #[test]
    fn remote_instruction_fences_are_not_cache_clears() {
        let metrics = Metrics { remote_fence_i: 10, jit_cache_clears: 2, jit_cache_evictions: 7, ..Metrics::default() };
        let json = metrics.json();
        assert!(json.contains("\"remote_fence_i\":10"));
        assert!(json.contains("\"invalidations\":{\"remote_fence_i\":0,\"explicit_clear\":2,\"evicted_blocks\":7"));
    }
}
