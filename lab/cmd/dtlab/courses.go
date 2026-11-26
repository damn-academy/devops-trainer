package main

import (
	"context"
	"fmt"
	"github.com/damn-academy/devops-trainer/lab/internal/courses"
	"github.com/damn-academy/devops-trainer/lab/internal/paths"
	"sort"
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
		for _, p := range c.Packages {
			status := "available"
			if old, ok := m[p.ID]; ok {
				status = "installed"
				if old.Version != p.Version {
					status = "update"
				}
			}
			fmt.Printf("%-16s %-10s %-12s %s\n", p.ID, status, p.Version, p.Title.EN)
			for _, course := range p.Courses {
				fmt.Printf("  %s: %s\n", course.ID, course.Title.EN)
			}
		}
		return nil
	case "update":
		var ids []string
		for id := range m {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		if len(ids) == 0 {
			fmt.Println("No installed courses. Run: dtlab course install academy")
			return nil
		}
		return s.Install(ctx, c, ids)
	default:
		return s.Install(ctx, c, args[1:])
	}
}
