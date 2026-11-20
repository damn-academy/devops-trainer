//go:build !windows

package backend

// Unsparse matters only on Windows (Hyper-V and sparse VHDX files).
func Unsparse(string) error { return nil }
