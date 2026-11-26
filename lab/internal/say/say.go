// Package say gives dtlab's advice in the learner's language. dtlab speaks
// English by default; when the locale is Russian (LC_ALL, LC_MESSAGES or
// LANG starting with "ru"), its messages and help are Russian.
//
// The other packages keep producing English text, which also goes into the
// JSON output unchanged; Translate turns a finished English message into
// Russian by matching it against the catalogue below, where every entry is
// the English fmt format the message was made with and its Russian text
// with {1}, {2}… in place of the format's verbs. A message the catalogue
// does not know stays English.
package say

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

// Russian reports whether the process locale asks for Russian. As in POSIX,
// the first of LC_ALL, LC_MESSAGES and LANG that is set decides; when none
// is set, the system's own language does (Windows sets no LANG).
func Russian() bool { return russian(os.Getenv, systemRussian) }

func russian(get func(string) string, system func() bool) bool {
	for _, k := range []string{"LC_ALL", "LC_MESSAGES", "LANG"} {
		if v := get(k); v != "" {
			return strings.HasPrefix(strings.ToLower(v), "ru")
		}
	}
	return system()
}

// T returns s in Russian when ru is set and the catalogue knows it.
func T(ru bool, s string) string {
	if !ru {
		return s
	}
	return Translate(s)
}

// Translate returns the Russian text of an English message, or the message
// itself when the catalogue does not know it.
func Translate(s string) string {
	if ru, ok := exact[s]; ok {
		return ru
	}
	for _, p := range compiled() {
		m := p.re.FindStringSubmatch(s)
		if m == nil {
			continue
		}
		out := p.ru
		for i, arg := range m[1:] {
			switch p.verbs[i] {
			case "s":
				arg = Translate(arg)
			case "f":
				arg = strings.Replace(arg, ".", ",", 1)
			}
			out = strings.ReplaceAll(out, "{"+strconv.Itoa(i+1)+"}", arg)
		}
		return out
	}
	return s
}

type pattern struct {
	re    *regexp.Regexp
	verbs []string
	ru    string
}

var (
	once     sync.Once
	patterns []pattern
	verb     = regexp.MustCompile(`%(\.\d+)?[dsfq]`)
)

// compiled turns each English format into an anchored regular expression.
func compiled() []pattern {
	once.Do(func() {
		for _, e := range formats {
			var re strings.Builder
			var verbs []string
			re.WriteString("^")
			last := 0
			for _, loc := range verb.FindAllStringIndex(e.en, -1) {
				re.WriteString(regexp.QuoteMeta(e.en[last:loc[0]]))
				v := e.en[loc[1]-1 : loc[1]]
				verbs = append(verbs, v)
				switch v {
				case "d":
					re.WriteString(`(-?\d+)`)
				case "f":
					re.WriteString(`(-?[\d.]+)`)
				default:
					re.WriteString(`(.+?)`)
				}
				last = loc[1]
			}
			re.WriteString(regexp.QuoteMeta(e.en[last:]))
			re.WriteString("$")
			patterns = append(patterns, pattern{regexp.MustCompile(re.String()), verbs, e.ru})
		}
	})
	return patterns
}
