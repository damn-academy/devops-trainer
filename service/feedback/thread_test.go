package main

import (
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestFollowPrivacyMergeAndReplies(t *testing.T) {
	s := testServer(t)
	a := sample()
	a.FollowToken = strings.Repeat("a", 64)
	b := sample()
	b.ID = "second-report"
	b.FollowToken = strings.Repeat("b", 64)
	for _, r := range []Report{a, b} {
		if _, e := s.save(r); e != nil {
			t.Fatal(e)
		}
	}
	call := func(method, id, token, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/feedback/"+id+"?token="+token, strings.NewReader(body))
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, r)
		return w
	}
	if w := call("GET", a.ID, b.FollowToken, ""); w.Code != 404 {
		t.Fatal("cross-thread access", w.Code)
	}
	if w := call("POST", a.ID, a.FollowToken, `{"id":"reply-learner","message":"Private learner text"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	update := func(id, parent, status, reply string) error {
		r := httptest.NewRequest("POST", "/admin", nil)
		r.Form = url.Values{"id": {id}, "merge": {parent}, "status": {status}, "reply": {reply}, "fixedBuild": {"build-42"}}
		return s.updateThread(r)
	}
	if e := update(b.ID, "", "fixed", "**Исправлено.**"); e != nil {
		t.Fatal(e)
	}
	if e := update(a.ID, b.ID, "duplicate", ""); e != nil {
		t.Fatal(e)
	}
	if e := update(b.ID, a.ID, "duplicate", ""); e == nil {
		t.Fatal("merge cycle accepted")
	}
	w := call("GET", a.ID, a.FollowToken, "")
	var thread Thread
	if json.Unmarshal(w.Body.Bytes(), &thread) != nil || thread.Status != "fixed" || !thread.Merged || len(thread.Replies) != 2 {
		t.Fatal(w.Code, w.Body)
	}
	w = call("GET", b.ID, b.FollowToken, "")
	if strings.Contains(w.Body.String(), "Private learner text") || strings.Contains(w.Body.String(), "transcript") || strings.Contains(w.Body.String(), "secret") {
		t.Fatal("thread privacy", w.Body)
	}
	items, e := s.list(url.Values{})
	raw, _ := json.Marshal(items)
	if e != nil || strings.Contains(string(raw), a.FollowToken) {
		t.Fatal("token leaked")
	}
	changed := a
	changed.FollowToken = b.FollowToken
	if _, e = s.save(changed); e == nil {
		t.Fatal("capability overwrite allowed")
	}
}
func TestContactAndFollowRateLimit(t *testing.T) {
	s := testServer(t)
	r := sample()
	r.Type = "contact"
	r.Contact = "@learner"
	r.FollowToken = strings.Repeat("c", 64)
	if e := validate(r); e != nil {
		t.Fatal(e)
	}
	s.save(r)
	for i := 0; i < 21; i++ {
		req := httptest.NewRequest("GET", "/api/feedback/"+r.ID+"?token="+r.FollowToken, nil)
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, req)
		if i == 20 && w.Code != 429 {
			t.Fatal("follow limit absent")
		}
	}
}

func TestPublicHintsOnlyExposeAggregate(t *testing.T) {
	t.Setenv("PUBLIC_HINTS", "1")
	s := testServer(t)
	r := sample()
	r.Context = map[string]any{"route": "#/lesson/example", "section": "intro"}
	s.save(r)
	for _, method := range []string{"GET", "POST", "GET"} {
		req := httptest.NewRequest(method, "/api/feedback/hint?route=%23%2Flesson%2Fexample&section=intro", nil)
		w := httptest.NewRecorder()
		s.handler().ServeHTTP(w, req)
		var result struct {
			Open  bool
			Count int
		}
		json.Unmarshal(w.Body.Bytes(), &result)
		if w.Code != 200 || !result.Open || strings.Contains(w.Body.String(), r.ID) || strings.Contains(w.Body.String(), r.Message) {
			t.Fatal(w.Code, w.Body)
		}
		if method == "POST" && result.Count != 1 {
			t.Fatal("vote missing")
		}
	}
}
func TestSafeMarkdown(t *testing.T) {
	value := string(markdownLight("**Hello** <script>alert(1)</script>"))
	if strings.Contains(value, "<script>") || !strings.Contains(value, "<strong>Hello</strong>") {
		t.Fatal(value)
	}
}
