package main

import (
	"html/template"
	"regexp"
)

func markdownLight(text string) template.HTML {
	escaped := template.HTMLEscapeString(text)
	escaped = regexp.MustCompile("\x60([^\x60]+)\x60|\\*\\*([^*]+)\\*\\*").ReplaceAllStringFunc(escaped, func(s string) string {
		if s[0] == '`' {
			return "<code>" + s[1:len(s)-1] + "</code>"
		}
		return "<strong>" + s[2:len(s)-2] + "</strong>"
	})
	// Only escaped text and the two constant tags above reach HTML.
	return template.HTML(escaped)
}
func statusLabel(status string) string {
	labels := map[string]string{"new": "получено", "triaged": "разбираем", "fixed": "исправлено", "wontfix": "не будем менять, ответ ниже", "duplicate": "уже известно, объединили с другим сообщением"}
	return labels[status]
}
func (s *server) adminReplies(id string) ([]Reply, error) {
	root, e := rootThread(s.db, id)
	if e != nil {
		return nil, e
	}
	rows, e := s.db.Query(`WITH RECURSIVE family(id) AS (SELECT id FROM threads WHERE id=$1 UNION ALL SELECT t.id FROM threads t JOIN family f ON t.parent=f.id) SELECT r.id,r.author,r.message,r.time FROM replies r WHERE r.thread IN (SELECT id FROM family) ORDER BY r.time,r.id`, root)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	replies := []Reply{}
	for rows.Next() {
		var r Reply
		if e = rows.Scan(&r.ID, &r.Author, &r.Message, &r.Time); e != nil {
			return nil, e
		}
		replies = append(replies, r)
	}
	return replies, rows.Err()
}
