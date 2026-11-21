//! R1 interpreter. Host time is injected, never inferred from instruction count.
mod bits;
pub mod metrics;
mod compressed;
pub use compressed::expand as expand_compressed;
mod decoded;
pub mod cpu;
pub mod devices;
pub mod fdt;
mod float;
pub mod memory;
mod sbi;
pub(crate) mod snapshot;
pub use cpu::{Cpu, Mode, Trap};
pub use memory::{Access, Memory, RAM_BASE};

#[cfg(target_arch = "wasm32")]
mod wasm;

pub mod elf;

#[cfg(target_arch = "wasm32")]
mod jit;
