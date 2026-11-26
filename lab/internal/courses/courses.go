// Package courses installs verified release bundles and composes an offline site.
package courses

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const DefaultURL = "https://github.com/damn-academy/devops-trainer/releases/latest/download/catalog.json"

type Text struct {
	RU string `json:"ru"`
	EN string `json:"en"`
}
type Course struct {
	ID    string `json:"id"`
	Title Text   `json:"title"`
}
type Package struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Version     string   `json:"version"`
	File        string   `json:"file"`
	Bytes       int64    `json:"bytes"`
	SHA256      string   `json:"sha256"`
	Title       Text     `json:"title"`
	Description Text     `json:"description"`
	Requires    []string `json:"requires"`
	Courses     []Course `json:"courses,omitempty"`
}
type Catalog struct {
	SchemaVersion int       `json:"schemaVersion"`
	Packages      []Package `json:"packages"`
}
type Store struct {
	Root, URL string
	Client    *http.Client
	Progress  io.Writer
}

var token = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)

func safe(s string) bool { return token.MatchString(s) && !strings.HasSuffix(s, ".") }
func New(root string) *Store {
	u := os.Getenv("DTLAB_CATALOG_URL")
	if u == "" {
		u = DefaultURL
	}
	return &Store{Root: filepath.Join(root, "courses"), URL: u, Client: &http.Client{Timeout: 30 * time.Minute}, Progress: os.Stderr}
}
func Parse(r io.Reader) (Catalog, error) {
	var c Catalog
	decoder := json.NewDecoder(io.LimitReader(r, (4<<20)+1))
	if err := decoder.Decode(&c); err != nil {
		return c, err
	}
	if decoder.InputOffset() > 4<<20 {
		return c, fmt.Errorf("catalog exceeds 4 MiB")
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return c, fmt.Errorf("unexpected data after catalog")
	}
	if c.SchemaVersion != 1 {
		return c, fmt.Errorf("unsupported catalog schema %d", c.SchemaVersion)
	}
	seen := map[string]bool{}
	for _, p := range c.Packages {
		digest, e := hex.DecodeString(p.SHA256)
		if !safe(p.ID) || !safe(p.Version) || !safe(p.File) || seen[p.ID] || (p.Kind != "course" && p.Kind != "pack") || p.Bytes <= 0 || e != nil || len(digest) != 32 || p.Title.EN == "" || p.Title.RU == "" {
			return c, fmt.Errorf("invalid catalog package %q", p.ID)
		}
		seen[p.ID] = true
	}
	for _, p := range c.Packages {
		for _, id := range p.Requires {
			if !seen[id] {
				return c, fmt.Errorf("%s requires unknown package %s", p.ID, id)
			}
		}
	}
	return c, nil
}
func (s *Store) get(ctx context.Context, u string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download unavailable: check your connection or DTLAB_CATALOG_URL: %w", err)
	}
	if resp.StatusCode != 200 {
		resp.Body.Close()
		return nil, fmt.Errorf("download unavailable: HTTP %d from %s", resp.StatusCode, u)
	}
	return resp, nil
}
func (s *Store) Catalog(ctx context.Context) (Catalog, error) {
	r, e := s.get(ctx, s.URL)
	if e != nil {
		return Catalog{}, e
	}
	defer r.Body.Close()
	return Parse(r.Body)
}
func (s *Store) Installed() (map[string]Package, error) {
	m := map[string]Package{}
	b, e := os.ReadFile(filepath.Join(s.Root, "installed.json"))
	if os.IsNotExist(e) {
		return m, nil
	}
	if e != nil {
		return nil, e
	}
	e = json.Unmarshal(b, &m)
	for id, p := range m {
		if !safe(id) || p.ID != id || !safe(p.Version) {
			return nil, fmt.Errorf("invalid installed state")
		}
	}
	return m, e
}
func (s *Store) lock() (func(), error) {
	if e := os.MkdirAll(s.Root, 0700); e != nil {
		return nil, e
	}
	p := filepath.Join(s.Root, ".lock")
	if e := os.Mkdir(p, 0700); e != nil {
		return nil, fmt.Errorf("course operation locked (%s): another command may be running: %w", p, e)
	}
	return func() { _ = os.Remove(p) }, nil
}
func (s *Store) save(m map[string]Package) error {
	b, e := json.MarshalIndent(m, "", "  ")
	if e != nil {
		return e
	}
	p := filepath.Join(s.Root, "installed.json.new")
	if e = os.WriteFile(p, b, 0600); e != nil {
		return e
	}
	return os.Rename(p, filepath.Join(s.Root, "installed.json"))
}
func Resolve(c Catalog, ids []string) ([]Package, error) {
	by := map[string]Package{}
	for _, p := range c.Packages {
		by[p.ID] = p
	}
	visiting := map[string]bool{}
	done := map[string]bool{}
	var out []Package
	var visit func(string) error
	visit = func(id string) error {
		if done[id] {
			return nil
		}
		p, ok := by[id]
		if !ok {
			return fmt.Errorf("unknown course or pack %q", id)
		}
		if visiting[id] {
			return fmt.Errorf("dependency cycle at %s", id)
		}
		visiting[id] = true
		for _, dep := range p.Requires {
			if e := visit(dep); e != nil {
				return e
			}
		}
		done[id] = true
		out = append(out, p)
		return nil
	}
	for _, id := range ids {
		if e := visit(id); e != nil {
			return nil, e
		}
	}
	return out, nil
}
func (s *Store) Install(ctx context.Context, c Catalog, ids []string) error {
	ps, e := Resolve(c, ids)
	if e != nil {
		return e
	}
	unlock, e := s.lock()
	if e != nil {
		return e
	}
	defer unlock()
	m, e := s.Installed()
	if e != nil {
		return e
	}
	for _, p := range ps {
		if old, ok := m[p.ID]; ok && old.Version == p.Version {
			if old.SHA256 != p.SHA256 {
				return fmt.Errorf("release changed without a new version: %s", p.ID)
			}
			continue
		}
		if e = s.download(ctx, p); e != nil {
			return fmt.Errorf("install %s: %w", p.ID, e)
		}
		m[p.ID] = p
	}
	if _, e := s.compose(m); e != nil {
		return e
	}
	return s.save(m)
}

type progress struct {
	out            io.Writer
	n, total, last int64
}

func (p *progress) Write(b []byte) (int, error) {
	p.n += int64(len(b))
	if p.out != nil && (p.n-p.last >= 1<<20 || p.n == p.total) {
		pct := int64(100)
		if p.total > 0 {
			pct = p.n * 100 / p.total
		}
		fmt.Fprintf(p.out, "\r%.1f / %.1f MB (%d%%)", float64(p.n)/1e6, float64(p.total)/1e6, pct)
		if p.n == p.total {
			fmt.Fprintln(p.out)
		}
		p.last = p.n
	}
	return len(b), nil
}
func (s *Store) download(ctx context.Context, p Package) error {
	parent := filepath.Join(s.Root, p.ID)
	if e := os.MkdirAll(parent, 0700); e != nil {
		return e
	}
	dst := filepath.Join(parent, p.Version)
	// A version is immutable. An uncommitted successful download can be reused.
	if b, e := os.ReadFile(dst + ".sha256"); e == nil && string(b) == p.SHA256 {
		return nil
	}
	if _, e := os.Stat(dst); e == nil {
		return fmt.Errorf("version directory already exists without matching checksum: %s", dst)
	}
	stage, e := os.MkdirTemp(parent, ".stage-")
	if e != nil {
		return e
	}
	defer os.RemoveAll(stage)
	u, e := url.Parse(s.URL)
	if e != nil {
		return e
	}
	u.Path = path.Join(path.Dir(u.Path), p.File)
	u.RawQuery = ""
	u.Fragment = ""
	r, e := s.get(ctx, u.String())
	if e != nil {
		return e
	}
	defer r.Body.Close()
	f, e := os.CreateTemp(parent, ".download-")
	if e != nil {
		return e
	}
	defer os.Remove(f.Name())
	defer f.Close()
	h := sha256.New()
	pr := &progress{out: s.Progress, total: p.Bytes}
	if s.Progress != nil {
		fmt.Fprintf(s.Progress, "Downloading %s %s\n", p.ID, p.Version)
	}
	n, e := io.Copy(io.MultiWriter(f, h, pr), io.LimitReader(r.Body, p.Bytes+1))
	if s.Progress != nil {
		fmt.Fprintln(s.Progress)
	}
	if e != nil {
		return e
	}
	if n != p.Bytes {
		return fmt.Errorf("size mismatch: got %d, expected %d", n, p.Bytes)
	}
	if hex.EncodeToString(h.Sum(nil)) != strings.ToLower(p.SHA256) {
		return fmt.Errorf("sha256 mismatch")
	}
	if _, e = f.Seek(0, 0); e != nil {
		return e
	}
	if e = unpack(f, stage); e != nil {
		return e
	}
	if p.Kind == "course" {
		if _, e = os.Stat(filepath.Join(stage, "index.html")); e != nil {
			return fmt.Errorf("course has no index.html")
		}
	}
	if e = os.Rename(stage, dst); e != nil {
		return e
	}
	return os.WriteFile(dst+".sha256", []byte(p.SHA256), 0600)
}
func unpack(r io.Reader, dst string) error {
	gz, e := gzip.NewReader(r)
	if e != nil {
		return e
	}
	defer gz.Close()
	tr := tar.NewReader(gz)
	var total int64
	for {
		h, e := tr.Next()
		if e == io.EOF {
			break
		}
		if e != nil {
			return e
		}
		name := strings.TrimSuffix(h.Name, "/")
		name = strings.TrimPrefix(name, "./")
		if name == "." && h.Typeflag == tar.TypeDir {
			continue
		}
		if !fs.ValidPath(name) || strings.ContainsAny(name, `\:`) || strings.HasPrefix(name, "/") {
			return fmt.Errorf("unsafe archive path %q", h.Name)
		}
		for _, part := range strings.Split(name, "/") {
			if strings.HasSuffix(part, ".") || strings.HasSuffix(part, " ") {
				return fmt.Errorf("unsafe archive path %q", name)
			}
		}
		p := filepath.Join(dst, filepath.FromSlash(name))
		switch h.Typeflag {
		case tar.TypeDir:
			if e = os.MkdirAll(p, 0755); e != nil {
				return e
			}
		case tar.TypeReg:
			total += h.Size
			if h.Size < 0 || total > 64<<30 {
				return fmt.Errorf("archive exceeds 64 GiB limit")
			}
			if e = os.MkdirAll(filepath.Dir(p), 0755); e != nil {
				return e
			}
			f, e := os.OpenFile(p, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
			if e != nil {
				return e
			}
			_, e = io.Copy(f, tr)
			ce := f.Close()
			if e != nil {
				return e
			}
			if ce != nil {
				return ce
			}
		default:
			return fmt.Errorf("unsupported archive entry %q (links are forbidden)", h.Name)
		}
	}
	_, e = io.Copy(io.Discard, gz)
	return e
}
func (s *Store) Remove(id string) error {
	if !safe(id) {
		return fmt.Errorf("invalid package id")
	}
	unlock, e := s.lock()
	if e != nil {
		return e
	}
	defer unlock()
	m, e := s.Installed()
	if e != nil {
		return e
	}
	if _, ok := m[id]; !ok {
		return fmt.Errorf("%s is not installed", id)
	}
	for _, p := range m {
		for _, dep := range p.Requires {
			if dep == id {
				return fmt.Errorf("%s is required by %s; remove it first", id, p.ID)
			}
		}
	}
	delete(m, id)
	if e = s.save(m); e != nil {
		return e
	}
	if e = os.RemoveAll(filepath.Join(s.Root, ".views")); e != nil {
		return e
	}
	return os.RemoveAll(filepath.Join(s.Root, id))
}

// Active composes packages at their original relative paths without copying bytes.
func (s *Store) Active() (string, error) {
	unlock, e := s.lock()
	if e != nil {
		return "", e
	}
	defer unlock()
	m, e := s.Installed()
	if e != nil {
		return "", e
	}
	return s.compose(m)
}

func (s *Store) compose(m map[string]Package) (string, error) {
	var e error
	if len(m) == 0 {
		return "", nil
	}
	var ids []string
	hasCourse := false
	for id, p := range m {
		ids = append(ids, id)
		hasCourse = hasCourse || p.Kind == "course"
	}
	if !hasCourse {
		return "", nil
	}
	sort.Strings(ids)
	b, _ := json.Marshal(m)
	sum := sha256.Sum256(b)
	dst := filepath.Join(s.Root, ".views", hex.EncodeToString(sum[:]))
	if _, e = os.Stat(dst); e == nil {
		return dst, nil
	}
	if e = os.MkdirAll(filepath.Dir(dst), 0700); e != nil {
		return "", e
	}
	tmp, e := os.MkdirTemp(filepath.Dir(dst), ".stage-")
	if e != nil {
		return "", e
	}
	defer os.RemoveAll(tmp)
	for _, id := range ids {
		src := filepath.Join(s.Root, id, m[id].Version)
		e = filepath.WalkDir(src, func(p string, d fs.DirEntry, e error) error {
			if e != nil {
				return e
			}
			rel, e := filepath.Rel(src, p)
			if e != nil {
				return e
			}
			to := filepath.Join(tmp, rel)
			if d.IsDir() {
				return os.MkdirAll(to, 0755)
			}
			if d.Type()&os.ModeSymlink != 0 {
				return fmt.Errorf("installed package contains a symlink")
			}
			return os.Link(p, to)
		})
		if e != nil {
			return "", e
		}
	}
	if e = os.Rename(tmp, dst); e != nil {
		return "", e
	}
	return dst, nil
}
