/*
Copyright 2026 The damn.academy Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// State is what a cluster needs to start again where it was: its keys and
// certificates (the PKI directory) and the contents of its store. A page
// saves it next to a checkpoint of a node's emulator, so that the restored
// node finds the same CA, tokens and objects.
type State struct {
	PKI  map[string][]byte
	Etcd []byte
}

// SaveState captures the running cluster.
func (c *Cluster) SaveState() (*State, error) {
	if c.store == nil {
		return nil, fmt.Errorf("cluster not started")
	}
	st := &State{PKI: map[string][]byte{}}
	entries, err := os.ReadDir(c.opts.PKIDir)
	if err != nil {
		return nil, err
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(c.opts.PKIDir, e.Name()))
		if err != nil {
			return nil, err
		}
		st.PKI[e.Name()] = data
	}
	if st.Etcd, err = c.store.Snapshot(); err != nil {
		return nil, err
	}
	return st, nil
}

// restorePKI writes saved PKI files and returns the kubeconfig path and the
// admin token, as writePKI and writeAuth would for a new cluster.
func restorePKI(dir string, files map[string][]byte) (kubeconfig, token string, err error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", "", err
	}
	for _, name := range []string{"ca.crt", "ca.key", "apiserver.crt", "apiserver.key", "sa.key", "sa.pub", "tokens.csv", "admin.kubeconfig"} {
		if _, ok := files[name]; !ok {
			return "", "", fmt.Errorf("saved state lacks %s", name)
		}
	}
	for name, data := range files {
		if name != filepath.Base(name) {
			return "", "", fmt.Errorf("bad file name %q", name)
		}
		if err := os.WriteFile(filepath.Join(dir, name), data, 0o600); err != nil {
			return "", "", err
		}
	}
	line, _ := bufio.NewReader(bytes.NewReader(files["tokens.csv"])).ReadString('\n')
	token, _, _ = strings.Cut(line, ",")
	return filepath.Join(dir, "admin.kubeconfig"), token, nil
}
