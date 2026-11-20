// Package sshkey makes the lab's SSH key and the ssh commands that use it.
// The key is the lab's own (never the learner's ~/.ssh keys), so removing
// the lab removes every way into its VMs.
package sshkey

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/pem"
	"errors"
	"os"
	"strconv"

	"golang.org/x/crypto/ssh"
)

// Ensure creates an ed25519 key pair at path (and path.pub) if missing and
// returns the public key in authorized_keys form.
func Ensure(path string) (string, error) {
	if pub, err := os.ReadFile(path + ".pub"); err == nil {
		if _, err := os.Stat(path); err == nil {
			return string(pub), nil
		}
	}
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", err
	}
	block, err := ssh.MarshalPrivateKey(priv, "dtlab")
	if err != nil {
		return "", err
	}
	sp, err := ssh.NewPublicKey(pub)
	if err != nil {
		return "", err
	}
	line := string(ssh.MarshalAuthorizedKey(sp))
	line = line[:len(line)-1] + " dtlab\n"
	if err := os.WriteFile(path, pem.EncodeToMemory(block), 0o600); err != nil {
		return "", err
	}
	if err := os.WriteFile(path+".pub", []byte(line), 0o644); err != nil {
		return "", err
	}
	return line, nil
}

// Args is the ssh command to a VM: its forwarded port on loopback (QEMU,
// host 127.0.0.1) or its own address (Hyper-V, port 22). Host keys are
// kept in the lab's own known_hosts, so the learner's file stays clean.
func Args(key, knownHosts, user, host string, port int, tty bool, command ...string) ([]string, error) {
	if port <= 0 {
		return nil, errors.New("this VM has no SSH (kuberoot is reached with kubectl)")
	}
	if host == "" {
		host = "127.0.0.1"
	}
	// One alias per VM: the forwarded port on loopback, the address otherwise.
	alias := "dtlab-" + strconv.Itoa(port)
	if host != "127.0.0.1" {
		alias = "dtlab-" + host
	}
	a := []string{"ssh", "-i", key, "-p", strconv.Itoa(port),
		"-o", "IdentitiesOnly=yes",
		"-o", "StrictHostKeyChecking=accept-new",
		"-o", "UserKnownHostsFile=" + knownHosts,
		"-o", "HostKeyAlias=" + alias,
		"-o", "ConnectTimeout=10",
		"-o", "LogLevel=ERROR"}
	if tty {
		a = append(a, "-t")
	} else {
		a = append(a, "-o", "BatchMode=yes")
	}
	a = append(a, user+"@"+host)
	return append(a, command...), nil
}
