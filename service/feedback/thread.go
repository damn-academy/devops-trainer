package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strings"
	"time"
)

type Reply struct {
	ID      string `json:"id"`
	Author  string `json:"author"`
	Message string `json:"message"`
	Time    string `json:"time"`
}
type Thread struct {
	Status     string  `json:"status"`
	FixedBuild string  `json:"fixedBuild"`
	FixedAt    string  `json:"fixedAt"`
	Merged     bool    `json:"merged"`
	Replies    []Reply `json:"replies"`
}

func randomToken() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func tokenHash(t string) string { b := sha256.Sum256([]byte(t)); return hex.EncodeToString(b[:]) }
func threadSchema(db *sql.DB) error {
	_, e := db.Exec(`CREATE TABLE IF NOT EXISTS feedback_votes(place TEXT PRIMARY KEY,total INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, secret TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'report', parent TEXT NOT NULL DEFAULT '', fixed_build TEXT NOT NULL DEFAULT '', fixed_at TEXT NOT NULL DEFAULT '');
 CREATE TABLE IF NOT EXISTS replies (id TEXT PRIMARY KEY, thread TEXT NOT NULL, owner TEXT NOT NULL, author TEXT NOT NULL, message TEXT NOT NULL, time TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS replies_thread ON replies(thread);
 INSERT INTO threads(id,secret) SELECT id,'' FROM feedback WHERE 1=1 ON CONFLICT(id) DO NOTHING;`)
	return e
}
func rootThread(q interface{ QueryRow(string, ...any) *sql.Row }, id string) (string, error) {
	seen := map[string]bool{}
	for !seen[id] {
		seen[id] = true
		var parent string
		if e := q.QueryRow("SELECT parent FROM threads WHERE id=$1", id).Scan(&parent); e != nil {
			return "", e
		}
		if parent == "" {
			return id, nil
		}
		id = parent
	}
	return "", errors.New("merge cycle")
}
func (s *server) thread(id string) (Thread, error) {
	out := Thread{Replies: []Reply{}}
	root, e := rootThread(s.db, id)
	if e != nil {
		return out, e
	}
	out.Merged = root != id
	e = s.db.QueryRow(`SELECT f.status,t.fixed_build,t.fixed_at FROM feedback f JOIN threads t ON t.id=f.id WHERE f.id=$1`, root).Scan(&out.Status, &out.FixedBuild, &out.FixedAt)
	if e != nil {
		return out, e
	}
	// Private learner replies stay with their owner; only author replies are shared after merging.
	rows, e := s.db.Query(`WITH RECURSIVE family(id) AS (SELECT id FROM threads WHERE id=$2 UNION ALL SELECT t.id FROM threads t JOIN family f ON t.parent=f.id) SELECT r.id,r.author,r.message,r.time FROM replies r WHERE r.owner=$1 OR (r.author='author' AND r.thread IN (SELECT id FROM family)) ORDER BY r.time,r.id`, id, root)
	if e != nil {
		return out, e
	}
	defer rows.Close()
	for rows.Next() {
		var v Reply
		if e = rows.Scan(&v.ID, &v.Author, &v.Message, &v.Time); e != nil {
			return out, e
		}
		out.Replies = append(out.Replies, v)
	}
	return out, rows.Err()
}
func (s *server) follow(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin != "" {
		if !s.origins[origin] {
			http.Error(w, "origin denied", 403)
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
	}
	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(204)
		return
	}
	if r.Method != "GET" && r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !s.followLimit.allow(ip, time.Now()) {
		http.Error(w, "rate limit", 429)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/api/feedback/")
	if id == "hint" {
		s.hint(w, r)
		return
	}
	var secret string
	token := r.URL.Query().Get("token")
	if !idPattern.MatchString(id) || len(token) != 64 {
		http.Error(w, "not found", 404)
		return
	}
	if e := s.db.QueryRow("SELECT secret FROM threads WHERE id=$1", id).Scan(&secret); e != nil || !equal(secret, tokenHash(token)) {
		http.Error(w, "not found", 404)
		return
	}
	if r.Method == "POST" {
		r.Body = http.MaxBytesReader(w, r.Body, 16000)
		var body struct {
			Message string `json:"message"`
			ID      string `json:"id"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || strings.TrimSpace(body.Message) == "" || len(body.Message) > 12000 || !idPattern.MatchString(body.ID) {
			http.Error(w, "invalid reply", 400)
			return
		}
		root, e := rootThread(s.db, id)
		if e != nil {
			http.Error(w, "storage unavailable", 503)
			return
		}
		_, e = s.db.Exec(`INSERT INTO replies(id,thread,owner,author,message,time) VALUES($1,$2,$3,'learner',$4,$5) ON CONFLICT(id) DO NOTHING`, body.ID, root, id, body.Message, time.Now().UTC().Format(time.RFC3339Nano))
		if e != nil {
			http.Error(w, "storage unavailable", 503)
			return
		}
	}
	thread, e := s.thread(id)
	if e != nil {
		http.Error(w, "storage unavailable", 503)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(thread)
}
func (s *server) updateThread(r *http.Request) error {
	id, parent := r.Form.Get("id"), strings.TrimSpace(r.Form.Get("merge"))
	reply, build := strings.TrimSpace(r.Form.Get("reply")), strings.TrimSpace(r.Form.Get("fixedBuild"))
	if len(reply) > 12000 || len(build) > 200 {
		return errors.New("invalid values")
	}
	tx, e := s.db.Begin()
	if e != nil {
		return e
	}
	defer tx.Rollback()
	if parent != "" {
		root, err := rootThread(tx, parent)
		if err != nil || root == id {
			return errors.New("invalid merge")
		}
		var kind, other string
		if tx.QueryRow("SELECT kind FROM threads WHERE id=$1", id).Scan(&kind) != nil || tx.QueryRow("SELECT kind FROM threads WHERE id=$1", root).Scan(&other) != nil || kind != other {
			return errors.New("invalid merge")
		}
		if _, e = tx.Exec("UPDATE threads SET parent=$1 WHERE id=$2", root, id); e != nil {
			return e
		}
	}
	if r.Form.Get("status") == "duplicate" && parent == "" {
		var existing string
		if tx.QueryRow("SELECT parent FROM threads WHERE id=$1", id).Scan(&existing) != nil || existing == "" {
			return errors.New("duplicate needs a main thread")
		}
	}
	fixedAt := ""
	if r.Form.Get("status") == "fixed" {
		fixedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if _, e = tx.Exec("UPDATE threads SET fixed_build=$1,fixed_at=CASE WHEN $2<>'' AND fixed_at<>'' THEN fixed_at ELSE $2 END WHERE id=$3", build, fixedAt, id); e != nil {
		return e
	}
	if reply != "" {
		root, err := rootThread(tx, id)
		if err != nil {
			return err
		}
		if _, e = tx.Exec(`INSERT INTO replies(id,thread,owner,author,message,time) VALUES($1,$2,$3,'author',$4,$5)`, randomToken(), root, id, reply, time.Now().UTC().Format(time.RFC3339Nano)); e != nil {
			return e
		}
	}
	if _, e = tx.Exec("UPDATE feedback SET status=$1,tags=$2,notes=notes || $3 WHERE id=$4", r.Form.Get("status"), r.Form.Get("tags"), r.Form.Get("note")+"\n", id); e != nil {
		return e
	}
	return tx.Commit()
}
