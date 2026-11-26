package agent

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func server(t *testing.T) (*Server, *[]FactsRequest) {
	dir := t.TempDir()
	_ = os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>course</html>"), 0o644)
	var got []FactsRequest
	s := &Server{Port: 7788, CourseDir: dir,
		Seed: func(vm, file string) (string, bool) {
			if vm == "cp-1" && file == "user-data" {
				return "#cloud-config\n", true
			}
			return "", false
		},
		Status: func(context.Context) any { return map[string]string{"profile": "standard"} },
		Facts: func(_ context.Context, r FactsRequest) (string, error) {
			got = append(got, r)
			return "-----BEGIN TRAINER FACTS-----\nx\n-----END TRAINER FACTS-----", nil
		},
	}
	return s, &got
}

func do(h http.Handler, method, url, host string, hdr map[string]string, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, url, strings.NewReader(body))
	r.Host = host
	for k, v := range hdr {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestCourseHeadersAndFallback(t *testing.T) {
	s, _ := server(t)
	w := do(s.Handler(), "GET", "/blocks/linux", "127.0.0.1:7788", nil, "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "course") {
		t.Fatal(w.Code, w.Body.String())
	}
	if w.Header().Get("Cross-Origin-Embedder-Policy") != "require-corp" || w.Header().Get("Cross-Origin-Opener-Policy") != "same-origin" {
		t.Error("isolation headers missing")
	}
}

func TestRebindingRefused(t *testing.T) {
	s, _ := server(t)
	if w := do(s.Handler(), "GET", "/", "evil.example:7788", nil, ""); w.Code != http.StatusMisdirectedRequest {
		t.Error(w.Code)
	}
}

func TestAPIGuards(t *testing.T) {
	s, got := server(t)
	h := s.Handler()
	body := `{"vm":"cp-1","script":"trainer-check.sh","nonce":"abcd12"}`
	json := map[string]string{"Content-Type": "application/json", "X-DTLab": "1"}
	if w := do(h, "POST", "/api/v1/facts", "127.0.0.1:7788", map[string]string{"Content-Type": "application/json"}, body); w.Code != 403 {
		t.Error("no X-DTLab header:", w.Code)
	}
	cross := map[string]string{"Content-Type": "application/json", "X-DTLab": "1", "Origin": "https://evil.example"}
	if w := do(h, "POST", "/api/v1/facts", "127.0.0.1:7788", cross, body); w.Code != 403 {
		t.Error("foreign origin:", w.Code)
	}
	if w := do(h, "POST", "/api/v1/facts", "10.10.1.254:7788", json, body); w.Code != 403 {
		t.Error("from a VM:", w.Code)
	}
	if w := do(h, "POST", "/api/v1/facts", "127.0.0.1:7788", json, `{"vm":"cp-1","nonce":"a;b"}`); w.Code != 400 {
		t.Error("bad nonce:", w.Code)
	}
	w := do(h, "POST", "/api/v1/facts", "127.0.0.1:7788", map[string]string{"Content-Type": "application/json", "X-DTLab": "1", "Origin": "http://127.0.0.1:7788"}, body)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "BEGIN TRAINER FACTS") || len(*got) != 1 || (*got)[0].VM != "cp-1" {
		t.Fatal(w.Code, w.Body.String())
	}
	s.AllowOrigins = []string{"https://trainer.example"}
	w = do(s.Handler(), "GET", "/api/v1/status", "localhost:7788", map[string]string{"X-DTLab": "1", "Origin": "https://trainer.example"}, "")
	if w.Code != 200 || w.Header().Get("Access-Control-Allow-Origin") != "https://trainer.example" || w.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Error("allowed origin:", w.Code, w.Header())
	}
	s.AllowOrigins = nil
	w = do(s.Handler(), "OPTIONS", "/api/v1/facts", "127.0.0.1:7788", map[string]string{"Origin": "https://damn.academy", "Access-Control-Request-Private-Network": "true"}, "")
	if w.Code != http.StatusNoContent || w.Header().Get("Access-Control-Allow-Origin") != "https://damn.academy" || w.Header().Get("Access-Control-Allow-Private-Network") != "true" {
		t.Error("default origin preflight:", w.Code, w.Header())
	}
	if w = do(s.Handler(), "GET", "/api/v1/status", "127.0.0.1:7788", map[string]string{"X-DTLab": "1", "Origin": "https://damn.academy.evil.example"}, ""); w.Code != http.StatusForbidden {
		t.Error("look-alike origin:", w.Code)
	}
}

func TestSeedsAndScriptsForVMs(t *testing.T) {
	s, _ := server(t)
	h := s.Handler()
	if w := do(h, "GET", "/seed/cp-1/user-data", "10.10.1.254:7788", nil, ""); w.Code != 200 || w.Body.String() != "#cloud-config\n" {
		t.Error(w.Code, w.Body.String())
	}
	if w := do(h, "GET", "/seed/cp-1/../../etc/passwd", "10.10.1.254:7788", nil, ""); w.Code == 200 {
		t.Error("seed path escape")
	}
	if w := do(h, "GET", "/check/trainer-check-host.sh", "10.10.1.254:7788", nil, ""); w.Code != 200 || !strings.Contains(w.Body.String(), "READ-ONLY") {
		t.Error(w.Code)
	}
	if w := do(h, "GET", "/", "10.10.1.254:7788", nil, ""); w.Code != 404 {
		t.Error("VMs should not get the course:", w.Code)
	}
}

// On Hyper-V a VM reaches the agent on the host's lab address and may name
// 127.0.0.1 in its Host header: the listener it came in on decides.
func TestAPIRefusedOnTheVMListener(t *testing.T) {
	s, _ := server(t)
	h := s.Handler()
	hdr := map[string]string{"Content-Type": "application/json", "X-DTLab": "1"}
	for local, want := range map[string]int{"10.10.1.254:7788": 403, "127.0.0.1:7788": 200} {
		r := httptest.NewRequest("GET", "/api/v1/status", nil)
		r.Host = "127.0.0.1:7788"
		for k, v := range hdr {
			r.Header.Set(k, v)
		}
		addr, _ := net.ResolveTCPAddr("tcp", local)
		r = r.WithContext(context.WithValue(r.Context(), http.LocalAddrContextKey, addr))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != want {
			t.Errorf("came in on %s: %d, want %d", local, w.Code, want)
		}
	}
}
