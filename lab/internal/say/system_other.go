//go:build !windows

package say

// systemRussian: elsewhere the locale variables are the system's language.
func systemRussian() bool { return false }
