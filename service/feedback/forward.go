package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"regexp"
	"time"
)

// Forward only a short notice, never the contact address or environment attachments.
// Stored reports remain authoritative if a downstream service is unavailable.
func forward(r Report) {
	client := &http.Client{Timeout: 10 * time.Second}
	post := func(endpoint, token string, body any) {
		b, _ := json.Marshal(body)
		req, e := http.NewRequest("POST", endpoint, bytes.NewReader(b))
		if e != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, e := client.Do(req)
		if e != nil {
			log.Print("feedback forwarding failed; report remains stored")
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Printf("feedback forwarding returned HTTP %d; report remains stored", resp.StatusCode)
		}
	}
	notice := "Feedback " + r.ID + " (" + r.Category + ") in " + str(r.Context, "lesson")
	if repo, token := os.Getenv("GITHUB_REPO"), os.Getenv("GITHUB_TOKEN"); repo != "" && token != "" && regexp.MustCompile(`^[\w.-]+/[\w.-]+$`).MatchString(repo) {
		post("https://api.github.com/repos/"+repo+"/issues", token, map[string]string{"title": notice, "body": "Review the full report in the feedback admin UI. Dedup hint: " + dedup(r)})
	}
	if token, chat := os.Getenv("TELEGRAM_BOT_TOKEN"), os.Getenv("TELEGRAM_CHAT_ID"); token != "" && chat != "" {
		post("https://api.telegram.org/bot"+token+"/sendMessage", "", map[string]string{"chat_id": chat, "text": notice})
	}
}
