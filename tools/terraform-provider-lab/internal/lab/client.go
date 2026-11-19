package lab

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// Client talks to the lab cloud REST API and its S3 endpoint.
type Client struct {
	Endpoint   string // http://api.cloud.lab/v1
	S3Endpoint string // http://s3.cloud.lab
	Token      string
	Project    string
	HTTP       *http.Client
	// OpTimeout bounds waiting for one slow operation (a VM boot).
	OpTimeout time.Duration

	mu    sync.Mutex
	keyID string
}

// APIError is the error body of the API: {"error": {code, message, status, request_id}}.
type APIError struct {
	Method, Path string
	Status       int
	Code         string
	Message      string
	RequestID    string
}

func (e *APIError) Error() string {
	s := fmt.Sprintf("%s %s: %d %s: %s", e.Method, e.Path, e.Status, e.Code, e.Message)
	if e.RequestID != "" {
		s += " (request " + e.RequestID + ")"
	}
	return s
}

// IsNotFound reports a 404 from the API or the S3 endpoint.
func IsNotFound(err error) bool {
	var e *APIError
	return errors.As(err, &e) && e.Status == http.StatusNotFound
}

// Operation is a slow change (VM, disk, load balancer).
type Operation struct {
	ID     string `json:"id"`
	Kind   string `json:"kind"`
	Status string `json:"status"`
	Target struct {
		Type string `json:"type"`
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"target"`
	Progress int    `json:"progress"`
	Message  string `json:"message"`
	Error    *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// OpError is a slow change that ended in ERROR; Target is the resource it was about.
type OpError struct {
	Op     Operation
	Target string
}

func (e *OpError) Error() string {
	msg := "unknown error"
	if e.Op.Error != nil {
		msg = e.Op.Error.Code + ": " + e.Op.Error.Message
	}
	return fmt.Sprintf("operation %s (%s %s) failed: %s", e.Op.ID, e.Op.Kind, e.Op.Target.Name, msg)
}

// P returns the path of a collection or resource inside the provider's project.
func (c *Client) P(parts ...string) string {
	esc := make([]string, len(parts))
	for i, p := range parts {
		esc[i] = url.PathEscape(p)
	}
	return "/projects/" + url.PathEscape(c.Project) + "/" + strings.Join(esc, "/")
}

// call sends one request. GETs are retried on transport errors: the lab
// network lives in an emulator and a connection may be reset while a VM boots.
func (c *Client) call(ctx context.Context, method, path string, in any) (int, []byte, error) {
	var body []byte
	if in != nil {
		var err error
		if body, err = json.Marshal(in); err != nil {
			return 0, nil, err
		}
	}
	attempts := 1
	if method == http.MethodGet {
		attempts = 4
	}
	var lastErr error
	for i := 0; i < attempts; i++ {
		if i > 0 {
			select {
			case <-ctx.Done():
				return 0, nil, ctx.Err()
			case <-time.After(time.Duration(i) * 500 * time.Millisecond):
			}
		}
		req, err := http.NewRequestWithContext(ctx, method, c.Endpoint+path, bytes.NewReader(body))
		if err != nil {
			return 0, nil, err
		}
		req.Header.Set("Authorization", "Bearer "+c.Token)
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "terraform-provider-lab")
		if in != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := c.HTTP.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		data, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if res.StatusCode >= 400 {
			return res.StatusCode, data, apiError(method, path, res.StatusCode, data)
		}
		return res.StatusCode, data, nil
	}
	return 0, nil, fmt.Errorf("%s %s%s: %w", method, c.Endpoint, path, lastErr)
}

func apiError(method, path string, status int, data []byte) error {
	var b struct {
		Error struct {
			Code      string `json:"code"`
			Message   string `json:"message"`
			RequestID string `json:"request_id"`
		} `json:"error"`
	}
	e := &APIError{Method: method, Path: path, Status: status}
	if json.Unmarshal(data, &b) == nil && b.Error.Code != "" {
		e.Code, e.Message, e.RequestID = b.Error.Code, b.Error.Message, b.Error.RequestID
	} else {
		e.Code, e.Message = http.StatusText(status), strings.TrimSpace(string(data))
	}
	return e
}

// Get reads one resource into out.
func (c *Client) Get(ctx context.Context, path string, out any) error {
	_, data, err := c.call(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, out)
}

// List reads every page of a collection.
func List[T any](ctx context.Context, c *Client, path string) ([]T, error) {
	var all []T
	token := ""
	for {
		p := path + "?limit=200"
		if token != "" {
			p += "&page_token=" + url.QueryEscape(token)
		}
		var page struct {
			Items         []T     `json:"items"`
			NextPageToken *string `json:"next_page_token"`
		}
		if err := c.Get(ctx, p, &page); err != nil {
			return nil, err
		}
		all = append(all, page.Items...)
		if page.NextPageToken == nil || *page.NextPageToken == "" {
			return all, nil
		}
		token = *page.NextPageToken
	}
}

// Create posts to a collection. A 202 answer is an operation: Create waits for
// it and reads the resource it made. When the operation fails, out still gets
// the resource (if it exists) and the error is an *OpError.
func (c *Client) Create(ctx context.Context, collection string, in, out any) error {
	status, data, err := c.call(ctx, http.MethodPost, collection, in)
	if err != nil {
		return err
	}
	if status != http.StatusAccepted {
		return json.Unmarshal(data, out)
	}
	return c.finish(ctx, collection, data, out)
}

// Patch changes a resource; a 202 answer is waited for like in Create.
func (c *Client) Patch(ctx context.Context, path string, in, out any) error {
	status, data, err := c.call(ctx, http.MethodPatch, path, in)
	if err != nil {
		return err
	}
	if status != http.StatusAccepted {
		return json.Unmarshal(data, out)
	}
	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return err
	}
	if _, err := c.Wait(ctx, op); err != nil {
		return err
	}
	return c.Get(ctx, path, out)
}

func (c *Client) finish(ctx context.Context, collection string, data []byte, out any) error {
	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return err
	}
	done, werr := c.Wait(ctx, op)
	id := done.Target.ID
	if id == "" {
		id = op.Target.ID
	}
	if id != "" {
		if gerr := c.Get(ctx, collection+"/"+url.PathEscape(id), out); gerr != nil && werr == nil {
			return gerr
		}
	}
	if werr != nil {
		var oe *OpError
		if errors.As(werr, &oe) {
			oe.Target = id
		}
		return werr
	}
	return nil
}

// Delete removes a resource and waits for a 202 operation. A missing resource is not an error.
func (c *Client) Delete(ctx context.Context, path string) error {
	status, data, err := c.call(ctx, http.MethodDelete, path, nil)
	if IsNotFound(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if status != http.StatusAccepted {
		return nil
	}
	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return err
	}
	_, err = c.Wait(ctx, op)
	return err
}

// Wait long-polls an operation until it is DONE or ERROR.
func (c *Client) Wait(ctx context.Context, op Operation) (Operation, error) {
	timeout := c.OpTimeout
	if timeout == 0 {
		timeout = 15 * time.Minute
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	for op.Status != "DONE" && op.Status != "ERROR" {
		var next Operation
		if err := c.Get(ctx, "/operations/"+url.PathEscape(op.ID)+"?wait=30", &next); err != nil {
			if ctx.Err() != nil {
				return op, fmt.Errorf("operation %s (%s) is still %s after %s: %s", op.ID, op.Kind, op.Status, timeout, op.Message)
			}
			return op, err
		}
		op = next
	}
	if op.Status == "ERROR" {
		return op, &OpError{Op: op}
	}
	return op, nil
}

// AccessKeyID is the S3 key id of the token (from /whoami), cached.
func (c *Client) AccessKeyID(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.keyID != "" {
		return c.keyID, nil
	}
	var who struct {
		AccessKeyID string `json:"access_key_id"`
	}
	if err := c.Get(ctx, "/whoami", &who); err != nil {
		return "", err
	}
	c.keyID = who.AccessKeyID
	return c.keyID, nil
}

// S3Object is what the provider knows of an object.
type S3Object struct {
	ETag        string
	Size        int64
	ContentType string
}

// S3 sends one request to the object storage. The endpoint accepts any
// signature; the key id in the Credential selects the project.
func (c *Client) S3(ctx context.Context, method, bucket, key string, body []byte, contentType string) (*http.Response, []byte, error) {
	id, err := c.AccessKeyID(ctx)
	if err != nil {
		return nil, nil, err
	}
	u := c.S3Endpoint + "/" + url.PathEscape(bucket) + "/" + escapeKey(key)
	req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(body))
	if err != nil {
		return nil, nil, err
	}
	now := time.Now().UTC()
	req.Header.Set("X-Amz-Date", now.Format("20060102T150405Z"))
	req.Header.Set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD")
	req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s/lab-1/s3/aws4_request, SignedHeaders=host;x-amz-date, Signature=lab", id, now.Format("20060102")))
	if body != nil {
		sum := md5.Sum(body)
		req.Header.Set("Content-MD5", b64(sum[:]))
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, nil, err
	}
	if res.StatusCode >= 400 {
		code := s3Code(data)
		if code == "" {
			code = http.StatusText(res.StatusCode)
		}
		return res, data, &APIError{Method: method, Path: "s3://" + bucket + "/" + key, Status: res.StatusCode, Code: code, Message: strings.TrimSpace(string(data))}
	}
	return res, data, nil
}

func escapeKey(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

func s3Code(data []byte) string {
	s := string(data)
	i := strings.Index(s, "<Code>")
	j := strings.Index(s, "</Code>")
	if i < 0 || j < i {
		return ""
	}
	return s[i+6 : j]
}

// ETagOf is the ETag the object storage gives to these bytes (hex MD5).
func ETagOf(b []byte) string {
	sum := md5.Sum(b)
	return hex.EncodeToString(sum[:])
}
