/*
Copyright 2026 The damn.academy Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Command loop-direct-io switches loop devices to direct I/O.
//
// The kuberoot boot medium mounts its root, a squashfs file on a FAT
// partition, through a loop device. Without direct I/O every block of the
// root is cached twice: as a page of the squashfs file on FAT, and as a
// page of the file squashfs reads from it. The guest's busybox has no
// losetup --direct-io, hence this program.
//
//	loop-direct-io /dev/loop0 [...]
package main

import (
	"fmt"
	"os"
	"syscall"
)

const loopSetDirectIO = 0x4C08 // LOOP_SET_DIRECT_IO, <linux/loop.h>

func main() {
	status := 0
	for _, dev := range os.Args[1:] {
		if err := setDirectIO(dev); err != nil {
			fmt.Fprintf(os.Stderr, "loop-direct-io: %s: %v\n", dev, err)
			status = 1
			continue
		}
		fmt.Printf("loop-direct-io: %s: direct I/O on\n", dev)
	}
	os.Exit(status)
}

func setDirectIO(dev string) error {
	f, err := os.Open(dev)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, _, errno := syscall.Syscall(syscall.SYS_IOCTL, f.Fd(), loopSetDirectIO, 1); errno != 0 {
		return errno
	}
	return nil
}
