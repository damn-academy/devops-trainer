// Package collect runs the course's read-only check scripts inside a lab VM
// and returns the block they print, the same block the learner would paste
// into the exam page by hand.
package collect

import (
	_ "embed"
	"errors"
	"fmt"
	"strings"
)

// Copies of web/public/check/trainer-check.sh and
// web/src/app/real/trainer-check-host.sh (kept equal by a test).
var (
	//go:embed scripts/trainer-check.sh
	K8sScript string
	//go:embed scripts/trainer-check-host.sh
	HostScript string
)

// Script names the browser and the CLI use.
const (
	Host = "trainer-check-host.sh"
	K8s  = "trainer-check.sh"
)

// ScriptText returns an embedded script by name.
func ScriptText(name string) (string, error) {
	switch name {
	case Host, "host", "":
		return HostScript, nil
	case K8s, "k8s":
		return K8sScript, nil
	}
	return "", fmt.Errorf("unknown check script %q", name)
}

// Request is one collection.
type Request struct {
	Script  string   `json:"script"`  // trainer-check-host.sh or trainer-check.sh
	Nonce   string   `json:"nonce"`   // the exam attempt's one-time code
	Machine string   `json:"machine"` // the exam's machine id (app-01, cp-1, vm1)
	Track   string   `json:"track"`
	Args    []string `json:"args"` // the exam's collector arguments, one per element ("--scope net")
	// Kubeconfig: run with KUBECONFIG set (the kuberoot cluster from the learner VM).
	Kubeconfig string `json:"-"`
	// Sudo: run as root (host checks read nft, sshd -T, nginx -T).
	Sudo bool `json:"-"`
}

// Validate keeps the request to what an exam page can ask for: the
// arguments go to a read-only script, but they still travel through a shell.
func (r Request) Validate() error {
	if _, err := ScriptText(r.Script); err != nil {
		return err
	}
	if !token(r.Nonce, 4, 64) {
		return errors.New("nonce: letters and digits only")
	}
	if r.Machine != "" && !name(r.Machine) {
		return errors.New("machine: a name like cp-1")
	}
	if r.Track != "" && !name(r.Track) {
		return errors.New("track: a name like k8s-2")
	}
	if len(r.Args) > 64 {
		return errors.New("too many arguments")
	}
	for _, a := range r.Args {
		if len(a) > 512 || strings.ContainsAny(a, "\x00\n\r") {
			return fmt.Errorf("bad argument %q", a)
		}
	}
	return nil
}

func token(s string, min, max int) bool {
	if len(s) < min || len(s) > max {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9') {
			return false
		}
	}
	return true
}

func name(s string) bool {
	if len(s) == 0 || len(s) > 63 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
			return false
		}
	}
	return true
}

// Quote makes one shell word.
func Quote(s string) string {
	if s != "" && strings.Trim(s, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_./:,=@%+-") == "" {
		return s
	}
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// RemoteCommand is what ssh runs in the VM; the script itself goes on
// stdin, so nothing is written to the VM's disk.
//
// An exam argument "--scope net" is two words, "--file /etc/hosts" too:
// the first space splits the flag from its value, as the exam page's own
// collector command does.
func (r Request) RemoteCommand() string {
	var w []string
	if r.Kubeconfig != "" {
		w = append(w, "env", "KUBECONFIG="+Quote(r.Kubeconfig))
	}
	if r.Sudo {
		w = append([]string{"sudo"}, w...)
	}
	w = append(w, "bash", "-s", "--", "--nonce", Quote(r.Nonce))
	if r.Machine != "" {
		w = append(w, "--machine", Quote(r.Machine))
	}
	if r.Track != "" {
		w = append(w, "--track", Quote(r.Track))
	}
	for _, a := range r.Args {
		flag, val, ok := strings.Cut(a, " ")
		w = append(w, Quote(flag))
		if ok {
			w = append(w, Quote(val))
		}
	}
	return strings.Join(w, " ")
}

// Block cuts the facts block out of a script's output: "TRAINER FACTS"
// (host checks, --machine) or "TRAINER CHECK" (the cluster tracks r1, r3).
func Block(out string) (string, error) {
	for _, kind := range []string{"FACTS", "CHECK"} {
		begin, end := "-----BEGIN TRAINER "+kind+"-----", "-----END TRAINER "+kind+"-----"
		a := strings.Index(out, begin)
		b := strings.Index(out, end)
		if a >= 0 && b > a {
			return out[a : b+len(end)], nil
		}
	}
	return "", errors.New("the check printed no facts block")
}
