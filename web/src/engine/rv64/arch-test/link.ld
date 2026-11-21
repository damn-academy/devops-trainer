OUTPUT_ARCH(riscv)
ENTRY(rvtest_entry_point)
SECTIONS {
  . = 0x80000000;
  .text : { *(.text.init) *(.text .text.*) }
  . = ALIGN(4096);
  .tohost : { *(.tohost) }
  . = ALIGN(4096);
  .data : { *(.data .data.*) *(.rodata .rodata.*) }
  .bss : { *(.bss .bss.*) *(COMMON) }
  _end = .;
}
