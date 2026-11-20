//go:build windows

package backend

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

// Unsparse clears the sparse attribute qemu-img sets on the files it
// writes on Windows: Hyper-V refuses to attach a sparse VHDX ("Virtual hard
// disk files must be uncompressed and unencrypted and must not be sparse").
func Unsparse(path string) error {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return err
	}
	h, err := windows.CreateFile(p, windows.GENERIC_READ|windows.GENERIC_WRITE, 0, nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(h)
	setSparse := byte(0) // FILE_SET_SPARSE_BUFFER{SetSparse: FALSE}
	var n uint32
	return windows.DeviceIoControl(h, windows.FSCTL_SET_SPARSE, (*byte)(unsafe.Pointer(&setSparse)), 1, nil, 0, &n, nil)
}
