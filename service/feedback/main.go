// Feedback receiver and server-rendered review UI. Credentials stay on the server.
package main

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	_ "github.com/jackc/pgx/v5/stdlib"
	"html/template"
	"io"
	"log"
	_ "modernc.org/sqlite"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"os/signal"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const maxSize = 256 * 1024

var categories = map[string]bool{"text": true, "unclear": true, "broken": true, "crash": true, "suggestion": true, "other": true}
var statuses = []string{"new", "triaged", "fixed", "wontfix", "duplicate"}
var idPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{8,80}$`)

type Report struct {
	Type        string         `json:"type,omitempty"`
	FollowToken string         `json:"followToken,omitempty"`
	Schema      string         `json:"schema"`
	ID          string         `json:"id"`
	Time        string         `json:"time"`
	Category    string         `json:"category"`
	Message     string         `json:"message"`
	Contact     string         `json:"contact"`
	Website     string         `json:"website"`
	Context     map[string]any `json:"context"`
	Attachments map[string]any `json:"attachments"`
	Omitted     []string       `json:"omitted"`
}
type Item struct {
	Report   Report `json:"report"`
	Status   string `json:"status"`
	Tags     string `json:"tags"`
	Notes    string `json:"notes"`
	Dedup    string `json:"dedup"`
	Received string `json:"received"`
	Thread   Thread `json:"thread"`
}

func validate(r Report) error {
	if r.Schema != "dt.feedback/v1" || !idPattern.MatchString(r.ID) || !categories[r.Category] || strings.TrimSpace(r.Message) == "" || len(r.Message) > 48000 || r.Website != "" || r.Context == nil {
		return errors.New("invalid report")
	}
	if _, err := time.Parse(time.RFC3339Nano, r.Time); err != nil {
		return errors.New("invalid time")
	}
	if r.Type != "" && r.Type != "report" && r.Type != "contact" {
		return errors.New("invalid type")
	}
	if r.FollowToken != "" && !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(r.FollowToken) {
		return errors.New("invalid token")
	}
	if r.Contact != "" && !regexp.MustCompile(`^@[A-Za-z0-9_]{5,32}$`).MatchString(r.Contact) {
		a, e := mail.ParseAddress(r.Contact)
		if e != nil || a.Address != r.Contact || len(r.Contact) > 254 {
			return errors.New("invalid contact")
		}
	}
	b, e := json.Marshal(r)
	if e != nil || len(b) > maxSize {
		return errors.New("report too large")
	}
	return nil
}
func str(m map[string]any, k string) string { s, _ := m[k].(string); return s }
func dedup(r Report) string {
	a := []string{r.Category}
	for _, k := range []string{"block", "lesson", "route", "section", "explainer", "step", "task", "quiz", "examCard"} {
		a = append(a, str(r.Context, k))
	}
	b, _ := json.Marshal(a)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:12])
}

type bucket struct {
	count int
	since time.Time
}
type limiter struct {
	mu      sync.Mutex
	entries map[string]bucket
	max     int
}

func (l *limiter) allow(ip string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.entries == nil {
		l.entries = map[string]bucket{}
	}
	for k, b := range l.entries {
		if now.Sub(b.since) >= time.Hour {
			delete(l.entries, k)
		}
	}
	b := l.entries[ip]
	if b.count == 0 {
		b.since = now
	}
	limit := l.max
	if limit == 0 {
		limit = 20
	}
	if b.count >= limit || (len(l.entries) >= 10000 && b.count == 0) {
		return false
	}
	b.count++
	l.entries[ip] = b
	return true
}

type server struct {
	db                    *sql.DB
	origins               map[string]bool
	token, user, password string
	limit                 limiter
	followLimit           limiter
	csrf                  string
}

func openDB(dsn string) (*sql.DB, error) {
	driver := "sqlite"
	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		driver = "pgx"
	}
	db, e := sql.Open(driver, dsn)
	if e != nil {
		return nil, e
	}
	db.SetMaxOpenConns(1)
	if driver == "sqlite" {
		if _, e = db.Exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000"); e != nil {
			db.Close()
			return nil, e
		}
	}
	_, e = db.Exec(`CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, payload TEXT NOT NULL, block TEXT NOT NULL, lesson TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', tags TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', dedup TEXT NOT NULL, received TEXT NOT NULL); CREATE INDEX IF NOT EXISTS feedback_place ON feedback(block,lesson,status); CREATE INDEX IF NOT EXISTS feedback_dedup ON feedback(dedup);`)
	if e != nil {
		db.Close()
		return nil, e
	}
	if e = threadSchema(db); e != nil {
		db.Close()
		return nil, e
	}
	return db, nil
}
func (s *server) save(r Report) (bool, error) {
	secret := r.FollowToken
	r.FollowToken = ""
	b, e := json.Marshal(r)
	if e != nil {
		return false, e
	}
	tx, e := s.db.Begin()
	if e != nil {
		return false, e
	}
	defer tx.Rollback()
	result, e := tx.Exec(`INSERT INTO feedback(id,payload,block,lesson,category,dedup,received) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`, r.ID, string(b), str(r.Context, "block"), str(r.Context, "lesson"), r.Category, dedup(r), time.Now().UTC().Format(time.RFC3339Nano))
	if e != nil {
		return false, e
	}
	n, e := result.RowsAffected()
	if e != nil {
		return false, e
	}
	if n > 0 {
		kind := r.Type
		if kind == "" {
			kind = "report"
		}
		hash := ""
		if secret != "" {
			hash = tokenHash(secret)
		}
		_, e = tx.Exec("INSERT INTO threads(id,secret,kind) VALUES($1,$2,$3)", r.ID, hash, kind)
		if e != nil {
			return false, e
		}
	} else if secret != "" {
		var hash string
		if tx.QueryRow("SELECT secret FROM threads WHERE id=$1", r.ID).Scan(&hash) != nil || !equal(hash, tokenHash(secret)) {
			return false, errors.New("id conflict")
		}
	}
	return n > 0, tx.Commit()
}
func (s *server) list(q url.Values) ([]Item, error) {
	query := `SELECT payload,status,tags,notes,dedup,received FROM feedback WHERE 1=1`
	args := []any{}
	for _, key := range []string{"block", "lesson", "category", "status", "id"} {
		if v := q.Get(key); v != "" {
			args = append(args, v)
			query += fmt.Sprintf(" AND %s=$%d", key, len(args))
		}
	}
	for _, v := range []struct{ key, op string }{{"from", ">="}, {"to", "<="}} {
		if val := q.Get(v.key); val != "" {
			if v.key == "to" && len(val) == 10 {
				val += "T23:59:59.999999999Z"
			}
			args = append(args, val)
			query += fmt.Sprintf(" AND received%s$%d", v.op, len(args))
		}
	}
	query += " ORDER BY received DESC"
	rows, e := s.db.Query(query, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	items := []Item{}
	for rows.Next() {
		var i Item
		var raw string
		if e = rows.Scan(&raw, &i.Status, &i.Tags, &i.Notes, &i.Dedup, &i.Received); e != nil {
			return nil, e
		}
		if e = json.Unmarshal([]byte(raw), &i.Report); e != nil {
			return nil, e
		}
		items = append(items, i)
	}
	return items, rows.Err()
}
func equal(a, b string) bool {
	return a != "" && b != "" && subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
func (s *server) auth(r *http.Request) bool {
	u, p, ok := r.BasicAuth()
	return (ok && equal(u, s.user) && equal(p, s.password)) || equal(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), s.token) || (ok && u == "token" && equal(p, s.token))
}
func (s *server) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/feedback", s.receive)
	mux.HandleFunc("/api/feedback/", s.follow)
	mux.HandleFunc("/admin", s.admin)
	mux.HandleFunc("/admin/", s.admin)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if e := s.db.PingContext(r.Context()); e != nil {
			http.Error(w, "unhealthy", 503)
			return
		}
		w.Write([]byte("ok"))
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
		mux.ServeHTTP(w, r)
	})
}
func (s *server) receive(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Access-Control-Allow-Methods", "POST")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Encoding")
		w.WriteHeader(204)
		return
	}
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !s.limit.allow(ip, time.Now()) {
		w.Header().Set("Retry-After", "3600")
		http.Error(w, "rate limit", 429)
		return
	}
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		http.Error(w, "JSON required", 415)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)
	defer r.Body.Close()
	var reader io.Reader = r.Body
	switch r.Header.Get("Content-Encoding") {
	case "gzip":
		gz, e := gzip.NewReader(r.Body)
		if e != nil {
			http.Error(w, "invalid gzip", 400)
			return
		}
		defer gz.Close()
		reader = gz
	case "", "identity":
	default:
		http.Error(w, "encoding not supported", 415)
		return
	}
	data, e := io.ReadAll(io.LimitReader(reader, maxSize+1))
	if e != nil || len(data) > maxSize {
		http.Error(w, "body too large or invalid", 413)
		return
	}
	var report Report
	dec := json.NewDecoder(strings.NewReader(string(data)))
	dec.DisallowUnknownFields()
	if e = dec.Decode(&report); e != nil {
		http.Error(w, "invalid JSON", 400)
		return
	}
	if dec.Decode(new(any)) != io.EOF {
		http.Error(w, "extra JSON", 400)
		return
	}
	if e = validate(report); e != nil {
		http.Error(w, e.Error(), 400)
		return
	}
	if report.FollowToken == "" {
		report.FollowToken = randomToken()
	}
	created, e := s.save(report)
	if e != nil {
		log.Print("feedback persistence failed")
		http.Error(w, "storage unavailable", 503)
		return
	}
	if created {
		go forward(report)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]string{"id": report.ID, "followToken": report.FollowToken})
}
func (s *server) admin(w http.ResponseWriter, r *http.Request) {
	if !s.auth(r) {
		w.Header().Set("WWW-Authenticate", `Basic realm="Feedback"`)
		http.Error(w, "authentication required", 401)
		return
	}
	if r.Method == "POST" {
		r.Body = http.MaxBytesReader(w, r.Body, 20000)
		if r.ParseForm() != nil || !equal(r.Form.Get("csrf"), s.csrf) {
			http.Error(w, "invalid form", 403)
			return
		}
		status := r.Form.Get("status")
		valid := false
		for _, v := range statuses {
			if status == v {
				valid = true
			}
		}
		if !valid || len(r.Form.Get("note")) > 8000 || len(r.Form.Get("tags")) > 1000 {
			http.Error(w, "invalid values", 400)
			return
		}
		if e := s.updateThread(r); e != nil {
			http.Error(w, "invalid update", 400)
			return
		}
		if r.Form.Get("notify") == "on" && strings.TrimSpace(r.Form.Get("reply")) != "" {
			items, e := s.list(url.Values{"id": {r.Form.Get("id")}})
			if e == nil && len(items) == 1 {
				go notifyContact(items[0].Report.Contact, r.Form.Get("reply"))
			}
		}
		http.Redirect(w, r, "/admin?id="+url.QueryEscape(r.Form.Get("id")), 303)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	items, e := s.list(r.URL.Query())
	if e != nil {
		http.Error(w, "storage unavailable", 503)
		return
	}
	if r.URL.Path == "/admin/export" {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", `attachment; filename="feedback.json"`)
		if r.URL.Query().Get("format") == "jsonl" {
			w.Header().Set("Content-Type", "application/x-ndjson")
			w.Header().Set("Content-Disposition", `attachment; filename="feedback.jsonl"`)
			for _, i := range items {
				json.NewEncoder(w).Encode(i)
			}
		} else {
			json.NewEncoder(w).Encode(items)
		}
		return
	}
	filtered := []Item{}
	for _, i := range items {
		kind := i.Report.Type
		if kind == "" {
			kind = "report"
		}
		if wanted := r.URL.Query().Get("type"); wanted != "" && wanted != kind {
			continue
		}
		i.Thread, _ = s.thread(i.Report.ID)
		i.Thread.Replies, _ = s.adminReplies(i.Report.ID)
		filtered = append(filtered, i)
	}
	items = filtered
	q := r.URL.Query()
	q.Del("id")
	data := struct {
		Items              []Item
		Detail             bool
		CSRF, Query, Build string
		Statuses           []string
	}{items, r.URL.Query().Get("id") != "", s.csrf, q.Encode(), env("BUILD_ID", "development"), statuses}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if e = adminTemplate.Execute(w, data); e != nil {
		log.Print("admin render failed")
	}
}

var adminTemplate = template.Must(template.New("admin").Funcs(template.FuncMap{"markdown": markdownLight, "status": statusLabel, "pretty": func(v any) string { b, _ := json.MarshalIndent(v, "", "  "); return string(b) }, "terminal": func(i Item) string {
	v := i.Report.Attachments["transcript"]
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}}).Parse(`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Сообщения учеников · Learner feedback</title><style>body{font:16px system-ui;background:#f3f5f8;color:#172437;max-width:1200px;margin:40px auto;padding:20px}h1{font-size:30px}a{color:#235b9a}table{border-collapse:collapse;width:100%;background:white}td,th{text-align:left;padding:14px;border-bottom:1px solid #ddd}input,select,button,textarea{font:inherit;padding:8px;margin:5px}label{display:inline-block}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:20px;border-radius:8px}.terminal{background:#101923;color:#bfe9cd;font:13px monospace}article{background:white;padding:24px;margin:20px 0}textarea{display:block;width:90%}</style><h1>Сообщения учеников / Learner feedback</h1><p><a href="/admin?type=report">Сообщения о курсе</a> · <a href="/admin?type=contact">Письма автору</a> · <a href="/admin/export?{{.Query}}">Скачать JSON / Export JSON</a> · <a href="/admin/export?{{.Query}}&amp;format=jsonl">Скачать JSONL / Export JSONL</a></p><form method="get"><label>Блок / Block <input name="block"></label><label>Урок / Lesson <input name="lesson"></label><label>Категория / Category <select name="category"><option value="">Все / All</option><option>text</option><option>unclear</option><option>broken</option><option>crash</option><option>suggestion</option><option>other</option></select></label><label>Статус / Status <select name="status"><option value="">Все / All</option>{{range .Statuses}}<option>{{.}}</option>{{end}}</select></label><label>С даты / From <input type="date" name="from"></label><label>По дату / To <input type="date" name="to"></label><button>Найти сообщения / Filter</button></form>{{if .Detail}}{{range .Items}}<article><h2>{{.Report.Message}}</h2><p>{{.Received}} · {{status .Status}} · {{.Report.Contact}}</p><p>Признак совпадения / Dedup hint: {{.Dedup}}</p><h3>Команды и вывод / Terminal</h3><pre class="terminal">{{terminal .}}</pre><h3>Контекст и приложения / Context and attachments</h3><pre>{{pretty .Report}}</pre><h3>Переписка</h3>{{range .Thread.Replies}}<p>{{.Author}} · {{.Time}}</p><div style="white-space:pre-wrap">{{markdown .Message}}</div>{{end}}<h3>Заметки / Notes</h3><pre>{{.Notes}}</pre><form method="post"><input type="hidden" name="csrf" value="{{$.CSRF}}"><input type="hidden" name="id" value="{{.Report.ID}}"><label>Статус / Status <select name="status">{{$status:=.Status}}{{range $.Statuses}}<option value="{{.}}" {{if eq . $status}}selected{{end}}>{{status .}}</option>{{end}}</select></label><label>Метки / Tags <input name="tags" value="{{.Tags}}"></label><label>Добавить заметку / Add a note <textarea name="note" maxlength="8000"></textarea></label><label>Ответьте ученику.<textarea name="reply" maxlength="12000"></textarea></label><label><input type="checkbox" name="notify">Уведомить по указанному адресу.</label><label>Исправлено в сборке.<input name="fixedBuild" value="{{if .Thread.FixedBuild}}{{.Thread.FixedBuild}}{{else}}{{$.Build}}{{end}}"></label><label>Объединить с сообщением по его номеру.<input name="merge"></label><button>Сохранить изменения</button></form></article>{{end}}{{else}}<table><thead><tr><th>Дата / Date</th><th>Место / Location</th><th>Сообщение / Message</th><th>Статус / Status</th><th>Совпадение / Dedup</th></tr></thead><tbody>{{range .Items}}<tr><td>{{.Received}}</td><td>{{index .Report.Context "block"}}<br>{{index .Report.Context "lesson"}}</td><td><a href="/admin?id={{.Report.ID}}">{{.Report.Message}}</a><br>{{.Report.Category}}</td><td>{{status .Status}}<br>{{.Tags}}</td><td>{{.Dedup}}</td></tr>{{else}}<tr><td colspan="5">Сообщений пока нет. / No reports yet.</td></tr>{{end}}</tbody></table>{{end}}</html>`))

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// envLimit reads a per-hour request limit; behind a proxy that hides client
// addresses every learner shares one bucket, so the operator must size it.
func envLimit(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, e := strconv.Atoi(v)
	if e != nil || n < 1 {
		log.Fatalf("%s must be a positive integer", key)
	}
	return n
}

func main() {
	db, e := openDB(env("DATABASE_URL", "feedback.sqlite"))
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	token, user, password := os.Getenv("ADMIN_TOKEN"), os.Getenv("ADMIN_USER"), os.Getenv("ADMIN_PASSWORD")
	if token == "" && (user == "" || password == "") {
		log.Fatal("set ADMIN_TOKEN or ADMIN_USER and ADMIN_PASSWORD")
	}
	csrfHash := sha256.Sum256([]byte(token + "\x00" + password + "\x00csrf"))
	s := &server{limit: limiter{max: envLimit("REPORT_LIMIT_PER_HOUR", 20)}, followLimit: limiter{max: envLimit("FOLLOW_LIMIT_PER_HOUR", 240)}, db: db, origins: map[string]bool{}, token: token, user: user, password: password, csrf: hex.EncodeToString(csrfHash[:])}
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			s.origins[o] = true
		}
	}
	srv := &http.Server{Addr: env("ADDR", "127.0.0.1:6101"), Handler: s.handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	log.Printf("feedback listening on %s", srv.Addr)
	if e = srv.ListenAndServe(); e != nil && e != http.ErrServerClosed {
		log.Fatal(e)
	}
}
