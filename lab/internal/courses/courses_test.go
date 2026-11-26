package courses

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func archive(t *testing.T, name, body string, kind byte) []byte {
	t.Helper()
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	tw := tar.NewWriter(gz)
	size := int64(len(body))
	if kind != tar.TypeReg {
		size = 0
	}
	if e := tw.WriteHeader(&tar.Header{Name: name, Mode: 0644, Size: size, Typeflag: kind, Linkname: "outside"}); e != nil {
		t.Fatal(e)
	}
	if size > 0 {
		_, _ = tw.Write([]byte(body))
	}
	_ = tw.Close()
	_ = gz.Close()
	return b.Bytes()
}
func pkg(id, version string, b []byte) Package {
	sum := sha256.Sum256(b)
	return Package{ID: id, Kind: "course", Version: version, File: id + ".tar.gz", Bytes: int64(len(b)), SHA256: hex.EncodeToString(sum[:]), Title: Text{RU: "Title", EN: "Title"}}
}
func fixture(t *testing.T, c *Catalog, files map[string][]byte) *Store {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/catalog.json" {
			_ = json.NewEncoder(w).Encode(c)
			return
		}
		b, ok := files[strings.TrimPrefix(r.URL.Path, "/")]
		if !ok {
			http.NotFound(w, r)
			return
		}
		_, _ = w.Write(b)
	}))
	t.Cleanup(srv.Close)
	s := New(t.TempDir())
	s.URL = srv.URL + "/catalog.json"
	s.Client = srv.Client()
	s.Progress = nil
	return s
}
func TestInstallUpdateRemove(t *testing.T) {
	b := archive(t, "index.html", "v1", tar.TypeReg)
	pack := archive(t, "v86/image", "machine", tar.TypeReg)
	p := pkg("academy", "1", b)
	q := pkg("v86", "1", pack)
	q.Kind = "pack"
	q.Requires = []string{"academy"}
	c := Catalog{1, []Package{p, q}}
	files := map[string][]byte{p.File: b, q.File: pack}
	s := fixture(t, &c, files)
	ctx := context.Background()
	got, e := s.Catalog(ctx)
	if e != nil || len(got.Packages) != 2 {
		t.Fatal(got, e)
	}
	if e = s.Install(ctx, got, []string{"v86"}); e != nil {
		t.Fatal(e)
	}
	active, e := s.Active()
	if e != nil {
		t.Fatal(e)
	}
	if _, e = os.Stat(filepath.Join(active, "v86/image")); e != nil {
		t.Fatal(e)
	}
	if e = s.Remove("academy"); e == nil {
		t.Fatal("removed dependency")
	}
	b2 := archive(t, "index.html", "v2", tar.TypeReg)
	p2 := pkg("academy", "2", b2)
	c.Packages[0] = p2
	files[p.File] = b2
	if e = s.Install(ctx, c, []string{"academy", "v86"}); e != nil {
		t.Fatal(e)
	}
	if old, e := os.ReadFile(filepath.Join(s.Root, "academy", "1", "index.html")); e != nil || string(old) != "v1" {
		t.Fatal("lost previous version", e)
	}
	active, e = s.Active()
	if e != nil {
		t.Fatal(e)
	}
	if now, _ := os.ReadFile(filepath.Join(active, "index.html")); string(now) != "v2" {
		t.Fatal("not updated")
	}
	if e = s.Remove("v86"); e != nil {
		t.Fatal(e)
	}
	if e = s.Remove("academy"); e != nil {
		t.Fatal(e)
	}
	m, _ := s.Installed()
	if len(m) != 0 {
		t.Fatal(m)
	}
}
func TestRejectedDownloadsKeepPrevious(t *testing.T) {
	for _, test := range []string{"sha", "truncated", "traversal", "absolute", "backslash", "symlink", "hardlink"} {
		t.Run(test, func(t *testing.T) {
			b := archive(t, "index.html", "old", tar.TypeReg)
			p := pkg("academy", "1", b)
			c := Catalog{1, []Package{p}}
			files := map[string][]byte{p.File: b}
			s := fixture(t, &c, files)
			ctx := context.Background()
			if e := s.Install(ctx, c, []string{"academy"}); e != nil {
				t.Fatal(e)
			}
			name := "index.html"
			kind := byte(tar.TypeReg)
			switch test {
			case "traversal":
				name = "../escape"
			case "absolute":
				name = "/escape"
			case "backslash":
				name = `..\escape`
			case "symlink":
				kind = tar.TypeSymlink
			case "hardlink":
				kind = tar.TypeLink
			}
			bad := archive(t, name, "new", kind)
			p2 := pkg("academy", "2", bad)
			switch test {
			case "sha":
				p2.SHA256 = strings.Repeat("0", 64)
			case "truncated":
				bad = bad[:len(bad)/2]
			}
			files[p.File] = bad
			c.Packages[0] = p2
			if e := s.Install(ctx, c, []string{"academy"}); e == nil {
				t.Fatal("accepted bad archive")
			}
			m, _ := s.Installed()
			if m["academy"].Version != "1" {
				t.Fatal("changed active version")
			}
		})
	}
}
func TestCatalogAndDependencies(t *testing.T) {
	b := archive(t, "index.html", "ok", tar.TypeReg)
	p := pkg("academy", "1", b)
	c := Catalog{1, []Package{p}}
	s := fixture(t, &c, nil)
	if _, e := s.Catalog(context.Background()); e != nil {
		t.Fatal(e)
	}
	for _, change := range []func(*Catalog){func(c *Catalog) { c.SchemaVersion = 2 }, func(c *Catalog) { c.Packages[0].ID = "../bad" }, func(c *Catalog) { c.Packages[0].Requires = []string{"missing"} }, func(c *Catalog) { c.Packages = append(c.Packages, c.Packages[0]) }} {
		c = Catalog{1, []Package{p}}
		change(&c)
		if _, e := s.Catalog(context.Background()); e == nil {
			t.Fatal("accepted invalid catalog")
		}
	}
	p.Requires = []string{"academy"}
	if _, e := Resolve(Catalog{1, []Package{p}}, []string{"academy"}); e == nil {
		t.Fatal("accepted cycle")
	}
	if _, e := Resolve(Catalog{1, []Package{p}}, []string{"missing"}); e == nil {
		t.Fatal("accepted missing id")
	}
}
func TestOffline(t *testing.T) {
	srv := httptest.NewServer(http.NotFoundHandler())
	srv.Close()
	s := New(t.TempDir())
	s.URL = srv.URL
	s.Client = srv.Client()
	_, e := s.Catalog(context.Background())
	if e == nil || !strings.Contains(e.Error(), "check your connection") {
		t.Fatal(e)
	}
}
func TestDependencyFailureDoesNotActivate(t *testing.T) {
	b := archive(t, "index.html", "ok", tar.TypeReg)
	p := pkg("academy", "1", b)
	q := pkg("v86", "1", b)
	q.Kind = "pack"
	q.Requires = []string{"academy"}
	c := Catalog{1, []Package{p, q}}
	s := fixture(t, &c, map[string][]byte{p.File: b})
	if e := s.Install(context.Background(), c, []string{"v86"}); e == nil {
		t.Fatal("missing pack accepted")
	}
	m, _ := s.Installed()
	if len(m) > 0 {
		t.Fatal("partial transaction activated")
	}
}
