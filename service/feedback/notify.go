package main

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/mail"
	"net/textproto"
	"os"
	"strings"
	"time"
)

// Telegram users must first start the bot. The administrator maps their handle to a chat id.
func notifyContact(contact, message string) {
	if contact == "" {
		return
	}
	if strings.HasPrefix(contact, "@") {
		chats := map[string]string{}
		json.Unmarshal([]byte(os.Getenv("TELEGRAM_CONTACTS")), &chats)
		chat, token := chats[contact], os.Getenv("TELEGRAM_BOT_TOKEN")
		if chat == "" || token == "" {
			log.Print("reply notification unavailable: Telegram contact not linked")
			return
		}
		body, _ := json.Marshal(map[string]string{"chat_id": chat, "text": message})
		client := &http.Client{Timeout: 10 * time.Second}
		resp, e := client.Post("https://api.telegram.org/bot"+token+"/sendMessage", "application/json", bytes.NewReader(body))
		if e != nil {
			log.Print("reply notification failed")
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			log.Print("reply notification failed")
		}
		return
	}
	addr, from := os.Getenv("SMTP_ADDR"), os.Getenv("SMTP_FROM")
	if addr == "" || from == "" {
		log.Print("reply notification unavailable: SMTP not configured")
		return
	}
	if _, e := mail.ParseAddress(from); e != nil || strings.ContainsAny(from, "\r\n") {
		return
	}
	host, _, e := net.SplitHostPort(addr)
	if e != nil {
		return
	}
	conn, e := net.DialTimeout("tcp", addr, 10*time.Second)
	if e != nil {
		log.Print("reply notification failed")
		return
	}
	conn.SetDeadline(time.Now().Add(15 * time.Second))

	defer conn.Close()
	c := textproto.NewConn(conn)
	command := func(code int, format string, args ...any) error {
		if e := c.PrintfLine(format, args...); e != nil {
			return e
		}
		_, _, e := c.ReadResponse(code)
		return e
	}
	if _, _, e = c.ReadResponse(220); e != nil {
		return
	}
	if e = command(250, "EHLO feedback.local"); e != nil {
		return
	}
	if e = command(220, "STARTTLS"); e != nil {
		log.Print("reply notification TLS failed")
		return
	}
	secure := tls.Client(conn, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
	if e = secure.Handshake(); e != nil {
		log.Print("reply notification TLS failed")
		return
	}
	c = textproto.NewConn(secure)
	if e = command(250, "EHLO feedback.local"); e != nil {
		return
	}
	if user := os.Getenv("SMTP_USER"); user != "" {
		credentials := base64.StdEncoding.EncodeToString([]byte("\x00" + user + "\x00" + os.Getenv("SMTP_PASSWORD")))
		if e = command(235, "AUTH PLAIN %s", credentials); e != nil {
			log.Print("reply notification authentication failed")
			return
		}
	}
	sender, _ := mail.ParseAddress(from)
	if e = command(250, "MAIL FROM:<%s>", sender.Address); e != nil {
		return
	}
	if _, e = mail.ParseAddress(contact); e != nil || strings.ContainsAny(contact, "\r\n") {
		return
	}
	if e = command(250, "RCPT TO:<%s>", contact); e != nil {
		return
	}
	if e = command(354, "DATA"); e != nil {
		return
	}
	w := c.DotWriter()
	_, e = fmt.Fprintf(w, "From: %s\r\nTo: %s\r\nSubject: DevOps Trainer: reply\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s", from, contact, message)
	if e != nil {
		log.Print("reply notification failed")
		return
	}
	if e = w.Close(); e != nil {
		return
	}
	if _, _, e = c.ReadResponse(250); e != nil {
		log.Print("reply notification failed")
		return
	}
	command(221, "QUIT")
}
