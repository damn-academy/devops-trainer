package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

var placeKeys = []string{"route", "section", "task", "quiz", "examCard", "explainer", "step"}

func placeKey(context map[string]any) string {
	parts := []string{}
	for _, k := range placeKeys {
		parts = append(parts, str(context, k))
	}
	return tokenHash(strings.Join(parts, "\x00"))
}
func (s *server) hint(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if os.Getenv("PUBLIC_HINTS") != "1" {
		json.NewEncoder(w).Encode(map[string]any{"open": false})
		return
	}
	context := map[string]any{}
	for _, k := range placeKeys {
		v := r.URL.Query().Get(k)
		if len(v) > 300 {
			http.Error(w, "invalid place", 400)
			return
		}
		context[k] = v
	}
	if str(context, "route") == "" {
		http.Error(w, "invalid place", 400)
		return
	}
	items, e := s.list(nil)
	if e != nil {
		http.Error(w, "storage unavailable", 503)
		return
	}
	key := placeKey(context)
	found := false
	for _, i := range items {
		if i.Report.Type != "contact" && placeKey(i.Report.Context) == key {
			thread, err := s.thread(i.Report.ID)
			if err == nil && (thread.Status == "new" || thread.Status == "triaged") {
				found = true
				break
			}
		}
	}
	if found && r.Method == "POST" {
		_, e = s.db.Exec("INSERT INTO feedback_votes(place,total) VALUES($1,1) ON CONFLICT(place) DO UPDATE SET total=feedback_votes.total+1", key)
		if e != nil {
			http.Error(w, "storage unavailable", 503)
			return
		}
	}
	var total int
	s.db.QueryRow("SELECT total FROM feedback_votes WHERE place=$1", key).Scan(&total)
	json.NewEncoder(w).Encode(map[string]any{"open": found, "count": total})
}
