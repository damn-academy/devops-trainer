// Package agent is the lab's local web server, on 127.0.0.1 only:
//
//	/                   the built course (web/dist), with the isolation
//	                    headers its engines need, so the course works offline
//	/check/<script>     the course's read-only check scripts
//	/seed/<vm>/...      cloud-init NoCloud seeds, read by the VMs at boot
//	/files/<name>       the offline file cache (kubectl for the learner VM)
//	/api/v1/status      the lab's VMs, for the course page
//	/api/v1/facts       runs a check script in a VM and returns its block
//
// The VMs reach it at http://10.10.1.254:7788 through the lab network's NAT
// to the host's loopback; nothing listens on the learner's real network.
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/damn-academy/devops-trainer/lab/internal/collect"
	"github.com/damn-academy/devops-trainer/lab/internal/profile"
)

// FactsRequest is the body of POST /api/v1/facts.
type FactsRequest struct {
	VM string `json:"vm"` // the lab VM to run in (learner, cp-1, kr-1)
	collect.Request
}

// Server is the agent's HTTP side.
type Server struct {
	Port      int
	CourseDir string // web/dist or <root>/course; empty: no course
	FilesDir  string
	Seed      func(vm, file string) (string, bool)
	Status    func(ctx context.Context) any
	Facts     func(ctx context.Context, r FactsRequest) (string, error)
	// AllowOrigins: a hosted copy of the course (https://...) allowed to
	// call the API besides DefaultOrigins; the local copy is same-origin.
	AllowOrigins []string
}

// DefaultOrigins are always allowed: the official course, so that its exam
// pages can take facts from the lab without any flag. The API still answers
// loopback clients only and requires the X-DTLab header.
var DefaultOrigins = []string{"https://damn.academy"}

// Handler routes the requests.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/status", s.guard(s.status))
	mux.HandleFunc("/api/v1/facts", s.guard(s.facts))
	mux.HandleFunc("/seed/", s.seed)
	mux.HandleFunc("/check/", s.check)
	mux.HandleFunc("/files/", s.files)
	mux.HandleFunc("/", s.course)
	return hostOnly(s.Port, mux)
}

// hostOnly refuses requests whose Host is not the lab's own name: a page
// on the internet that points a DNS name at 127.0.0.1 (DNS rebinding)
// sends its own Host header and gets nothing.
func hostOnly(port int, next http.Handler) http.Handler {
	p := strconv.Itoa(port)
	ok := map[string]bool{"127.0.0.1:" + p: true, "localhost:" + p: true, "[::1]:" + p: true, profile.HostIP + ":" + p: true}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ok[r.Host] {
			http.Error(w, "dtlab: unknown host", http.StatusMisdirectedRequest)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// guard admits API calls from the course page only: the local copy (same
// origin) or an origin named with --allow-origin, never from the VMs.
func (s *Server) guard(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.Host, profile.HostIP+":") || !fromLoopback(r) {
			http.Error(w, "dtlab: the API is for the course page on this computer", http.StatusForbidden)
			return
		}
		origin := r.Header.Get("Origin")
		self := origin == "" || origin == "http://"+r.Host
		allowed := self
		for _, o := range append(append([]string{}, DefaultOrigins...), s.AllowOrigins...) {
			if origin == o {
				allowed = true
				w.Header().Set("Access-Control-Allow-Origin", o)
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-DTLab")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
				w.Header().Set("Access-Control-Allow-Private-Network", "true")
				w.Header().Set("Vary", "Origin")
			}
		}
		if !allowed {
			http.Error(w, "dtlab: origin not allowed", http.StatusForbidden)
			return
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		// Browsers send this header only from scripts, and only to the same
		// origin or after a CORS preflight: forms and images cannot.
		if r.Header.Get("X-DTLab") != "1" {
			http.Error(w, "dtlab: missing X-DTLab header", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		h(w, r)
	}
}

func (s *Server) status(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "GET only", http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, s.Status(r.Context()))
}

func (s *Server) facts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		http.Error(w, "application/json only", http.StatusUnsupportedMediaType)
		return
	}
	var req FactsRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := req.Request.Validate(); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Minute)
	defer cancel()
	block, err := s.Facts(ctx, req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"block": block})
}

func (s *Server) seed(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/seed/"), "/")
	if len(parts) != 2 {
		http.NotFound(w, r)
		return
	}
	switch parts[1] {
	case "meta-data", "user-data", "vendor-data", "network-config":
	default:
		http.NotFound(w, r)
		return
	}
	body, ok := s.Seed(parts[0], parts[1])
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = io.WriteString(w, body)
}

func (s *Server) check(w http.ResponseWriter, r *http.Request) {
	text, err := collect.ScriptText(path.Base(r.URL.Path))
	if err != nil || path.Base(r.URL.Path) == "host" || path.Base(r.URL.Path) == "k8s" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/x-shellscript; charset=utf-8")
	_, _ = io.WriteString(w, text)
}

func (s *Server) files(w http.ResponseWriter, r *http.Request) {
	name := path.Base(r.URL.Path)
	if s.FilesDir == "" || name == "." || name == "/" || strings.HasPrefix(name, ".") {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(s.FilesDir, name))
}

// course serves the built course with the headers of vite.config.ts:
// cross-origin isolation for SharedArrayBuffer (v86).
func (s *Server) course(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.Host, profile.HostIP+":") {
		http.NotFound(w, r) // the VMs get seeds, scripts and files, not the course
		return
	}
	if s.CourseDir == "" {
		http.Error(w, "dtlab: no course copy; run `dtlab serve --course <web/dist>`", http.StatusNotFound)
		return
	}
	w.Header().Set("Cross-Origin-Opener-Policy", "same-origin")
	w.Header().Set("Cross-Origin-Embedder-Policy", "require-corp")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	p := path.Clean("/" + r.URL.Path)
	full := filepath.Join(s.CourseDir, filepath.FromSlash(p))
	if st, err := os.Stat(full); err != nil || (st.IsDir() && !exists(filepath.Join(full, "index.html"))) {
		full = filepath.Join(s.CourseDir, "index.html")
	}
	http.ServeFile(w, r, full)
}

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// fromLoopback: the request came in on a loopback listener. On Hyper-V the
// agent also listens on the host's lab address for the VMs, and a VM could
// name 127.0.0.1 in its Host header there.
func fromLoopback(r *http.Request) bool {
	a, ok := r.Context().Value(http.LocalAddrContextKey).(net.Addr)
	if !ok {
		return true
	}
	host, _, err := net.SplitHostPort(a.String())
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// ListenVMs opens the agent's port on the host's address on the lab
// network, for VMs on Hyper-V's internal switch (QEMU VMs reach the
// loopback listener through the lab switch).
func ListenVMs(port int) (net.Listener, error) {
	return net.Listen("tcp", net.JoinHostPort(profile.HostIP, strconv.Itoa(port)))
}

// Listen opens the agent's port on loopback.
func Listen(port int) (net.Listener, error) {
	ln, err := net.Listen("tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(port)))
	if err != nil {
		var op *net.OpError
		if errors.As(err, &op) {
			return nil, errors.New("port " + strconv.Itoa(port) + " is taken: is another dtlab agent running? (dtlab status)")
		}
		return nil, err
	}
	return ln, nil
}
