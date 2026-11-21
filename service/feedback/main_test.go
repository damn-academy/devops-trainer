package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func sample() Report {
	return Report{Schema: "dt.feedback/v1", ID: "test-12345678", Time: time.Now().UTC().Format(time.RFC3339), Category: "crash", Message: "The lab stopped", Context: map[string]any{"block": "linux", "lesson": "linux.terminal", "task": "hello"}, Attachments: map[string]any{"transcript": "$ pwd\n/home/learner"}}
}
func testServer(t *testing.T) *server {
	t.Helper()
	db, e := openDB(filepath.Join(t.TempDir(), "test.sqlite"))
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { db.Close() })
	return &server{db: db, token: "test-token", csrf: "csrf", origins: map[string]bool{"https://course.example": true}}
}
func TestValidation(t *testing.T) {
	if e := validate(sample()); e != nil {
		t.Fatal(e)
	}
	for _, change := range []func(*Report){func(r *Report) { r.Message = " " }, func(r *Report) { r.Category = "invalid" }, func(r *Report) { r.Website = "spam" }, func(r *Report) { r.Contact = "bad" }, func(r *Report) { r.ID = "../bad" }, func(r *Report) { r.Time = "yesterday" }, func(r *Report) { r.Attachments = map[string]any{"large": strings.Repeat("x", maxSize)} }} {
		r := sample()
		change(&r)
		if validate(r) == nil {
			t.Fatalf("accepted invalid report: %+v", r.ID)
		}
	}
}
func TestRateLimit(t *testing.T) {
	var l limiter
	now := time.Now()
	for i := 0; i < 20; i++ {
		if !l.allow("a", now) {
			t.Fatal(i)
		}
	}
	if l.allow("a", now) {
		t.Fatal("limit not enforced")
	}
	if !l.allow("b", now) || !l.allow("a", now.Add(time.Hour)) {
		t.Fatal("independent bucket or refill failed")
	}
}
func TestEnvLimit(t *testing.T) {
	t.Setenv("REPORT_LIMIT_PER_HOUR", "")
	if envLimit("REPORT_LIMIT_PER_HOUR", 20) != 20 {
		t.Fatal("default not used")
	}
	t.Setenv("REPORT_LIMIT_PER_HOUR", "500")
	if envLimit("REPORT_LIMIT_PER_HOUR", 20) != 500 {
		t.Fatal("configured limit not used")
	}
}
func TestDedup(t *testing.T) {
	a, b := sample(), sample()
	b.ID = "another-123"
	b.Message = "Other words"
	if dedup(a) != dedup(b) {
		t.Fatal("text affected hint")
	}
	b.Context = map[string]any{"lesson": "other"}
	if dedup(a) == dedup(b) {
		t.Fatal("place ignored")
	}
}
func TestReceive(t *testing.T) {
	s := testServer(t)
	report := sample()
	report.FollowToken = strings.Repeat("a", 64)
	raw, _ := json.Marshal(report)
	var zipped bytes.Buffer
	gz := gzip.NewWriter(&zipped)
	gz.Write(raw)
	gz.Close()
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("POST", "/api/feedback", bytes.NewReader(zipped.Bytes()))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Content-Encoding", "gzip")
		req.Header.Set("Origin", "https://course.example")
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, req)
		if w.Code != 201 {
			t.Fatalf("%d %s", w.Code, w.Body)
		}
	}
	items, e := s.list(url.Values{})
	if e != nil || len(items) != 1 {
		t.Fatal("idempotency", e, len(items))
	}
	for _, tc := range []struct {
		origin, body string
		code         int
	}{{"https://evil.example", string(raw), 403}, {"", string(raw) + "{}", 400}, {"", strings.Repeat("x", maxSize+1), 413}} {
		req := httptest.NewRequest("POST", "/api/feedback", strings.NewReader(tc.body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", tc.origin)
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, req)
		if w.Code != tc.code {
			t.Fatalf("got %d want %d", w.Code, tc.code)
		}
	}
}
func TestAdminExportAndUpdate(t *testing.T) {
	s := testServer(t)
	s.save(sample())
	for _, format := range []string{"json", "jsonl"} {
		req := httptest.NewRequest("GET", "/admin/export?block=linux&status=new&format="+format, nil)
		req.Header.Set("Authorization", "Bearer test-token")
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, req)
		if w.Code != 200 || !strings.Contains(w.Body.String(), "/home/learner") {
			t.Fatal(w.Code, w.Body)
		}
		if format == "json" {
			var a []Item
			if json.Unmarshal(w.Body.Bytes(), &a) != nil || len(a) != 1 {
				t.Fatal("bad JSON export")
			}
		} else {
			var a Item
			if json.Unmarshal(w.Body.Bytes(), &a) != nil || a.Report.ID != sample().ID {
				t.Fatal("bad JSONL export")
			}
		}
	}
	req := httptest.NewRequest("GET", "/admin", nil)
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatal("admin unprotected")
	}
	for _, csrf := range []string{"bad", "csrf"} {
		form := url.Values{"csrf": {csrf}, "id": {sample().ID}, "status": {"triaged"}, "note": {"Investigating"}, "tags": {"linux,terminal"}}
		req = httptest.NewRequest("POST", "/admin", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetBasicAuth("token", "test-token")
		w = httptest.NewRecorder()
		s.handler().ServeHTTP(w, req)
		want := http.StatusSeeOther
		if csrf == "bad" {
			want = 403
		}
		if w.Code != want {
			t.Fatal(w.Code)
		}
	}
	items, e := s.list(url.Values{"status": {"triaged"}})
	if e != nil || len(items) != 1 || !strings.Contains(items[0].Notes, "Investigating") {
		t.Fatal("update failed", e)
	}
	req = httptest.NewRequest("GET", "/admin?block=missing", nil)
	req.SetBasicAuth("token", "test-token")
	w = httptest.NewRecorder()
	s.handler().ServeHTTP(w, req)
	if w.Code != 200 || strings.Contains(w.Body.String(), "The lab stopped") {
		t.Fatal("filter failed")
	}
}
