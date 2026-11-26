package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"sort"

	"github.com/damn-academy/devops-trainer/lab/internal/courses"
	"github.com/damn-academy/devops-trainer/lab/internal/paths"
	"github.com/damn-academy/devops-trainer/lab/internal/say"
)

func courseCmd(ctx context.Context, args []string) error {
	s := courses.New(paths.Root())
	if len(args) == 2 && args[0] == "remove" {
		return s.Remove(args[1])
	}
	if len(args) == 0 || (args[0] != "list" && args[0] != "install" && args[0] != "update") {
		return fmt.Errorf("usage: dtlab courses | course install <id>... | course update | course remove <id>")
	}
	if (args[0] == "install" && len(args) < 2) || (args[0] != "install" && len(args) != 1) {
		return fmt.Errorf("invalid course arguments")
	}
	c, e := s.Catalog(ctx)
	if e != nil {
		return e
	}
	m, e := s.Installed()
	if e != nil {
		return e
	}
	switch args[0] {
	case "list":
		listCatalog(os.Stdout, c, m, say.Russian())
		return nil
	case "update":
		ru := say.Russian()
		if len(m) == 0 {
			fmt.Println(say.T(ru, "No installed courses. Run: dtlab course install academy"))
			return nil
		}
		var ids []string
		for _, p := range c.Packages {
			if old, ok := m[p.ID]; ok && old.Version != p.Version {
				ids = append(ids, p.ID)
			}
		}
		sort.Strings(ids)
		if len(ids) == 0 {
			fmt.Println(say.T(ru, "All installed courses are up to date."))
			return nil
		}
		return s.Install(ctx, c, ids)
	default:
		return s.Install(ctx, c, args[1:])
	}
}

// listCatalog prints `dtlab courses`: every package with its state and
// version, and the courses inside it, with the titles in the learner's
// language (the catalogue carries both).
func listCatalog(w io.Writer, c courses.Catalog, installed map[string]courses.Package, ru bool) {
	for _, p := range c.Packages {
		status := "available"
		if old, ok := installed[p.ID]; ok {
			status = "installed"
			if old.Version != p.Version {
				status = "update"
			}
		}
		width := 10
		if ru {
			width = 16
		}
		fmt.Fprintf(w, "%-16s %-*s %-12s %s\n", p.ID, width, say.T(ru, status), p.Version, title(p.Title, ru))
		for _, course := range p.Courses {
			fmt.Fprintf(w, "  %s: %s\n", course.ID, title(course.Title, ru))
		}
	}
}

func title(t courses.Text, ru bool) string {
	if ru && t.RU != "" {
		return t.RU
	}
	return t.EN
}
