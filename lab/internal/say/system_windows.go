package say

import (
	"strings"

	"golang.org/x/sys/windows"
)

// systemRussian: the first display language of the Windows user.
func systemRussian() bool {
	langs, err := windows.GetUserPreferredUILanguages(windows.MUI_LANGUAGE_NAME)
	return err == nil && len(langs) > 0 && strings.HasPrefix(strings.ToLower(langs[0]), "ru")
}
