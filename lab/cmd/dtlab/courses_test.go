package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/damn-academy/devops-trainer/lab/internal/courses"
)

func TestListCatalogSpeaksTheLocale(t *testing.T) {
	c := courses.Catalog{Packages: []courses.Package{
		{ID: "academy", Version: "0.2.0", Title: courses.Text{EN: "All damn.academy courses", RU: "Все курсы damn.academy"},
			Courses: []courses.Course{{ID: "devops", Title: courses.Text{EN: "DevOps engineer profession", RU: "Профессия DevOps-инженер"}}}},
		{ID: "v86", Version: "0.2.0", Title: courses.Text{EN: "In-tab Linux machines", RU: "Машины Linux во вкладке"}},
	}}
	installed := map[string]courses.Package{"v86": {ID: "v86", Version: "0.1.0"}}

	var en bytes.Buffer
	listCatalog(&en, c, installed, false)
	for _, want := range []string{"academy          available  0.2.0        All damn.academy courses", "  devops: DevOps engineer profession", "v86              update"} {
		if !strings.Contains(en.String(), want) {
			t.Errorf("English list lacks %q:\n%s", want, en.String())
		}
	}

	var ru bytes.Buffer
	listCatalog(&ru, c, installed, true)
	for _, want := range []string{"можно поставить", "Все курсы damn.academy", "  devops: Профессия DevOps-инженер", "есть обновление", "Машины Linux во вкладке"} {
		if !strings.Contains(ru.String(), want) {
			t.Errorf("Russian list lacks %q:\n%s", want, ru.String())
		}
	}
	if strings.Contains(ru.String(), "available") || strings.Contains(ru.String(), "All damn.academy") {
		t.Errorf("Russian list has English:\n%s", ru.String())
	}
}

func TestCheckLabelsAreAligned(t *testing.T) {
	for en, ru := range checkLabels {
		if len([]rune(ru))+1 > labelWidth(true) {
			t.Errorf("%s: the Russian label %q does not fit", en, ru)
		}
		if len(en)+1 > labelWidth(false) {
			t.Errorf("the English label %q does not fit", en)
		}
	}
}
