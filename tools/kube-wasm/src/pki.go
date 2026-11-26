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
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

// writePKI creates the files the control plane flags point at: a cluster
// CA, an apiserver serving certificate signed by it and the service
// account signing key. ECDSA P-256 is used everywhere because RSA key
// generation is slow without native big-integer arithmetic.
func writePKI(dir string, ips []net.IP) error {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	now := time.Now()
	caKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	caTmpl := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "kubernetes"},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(10 * 365 * 24 * time.Hour),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		BasicConstraintsValid: true,
		IsCA:                  true,
	}
	caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
	if err != nil {
		return err
	}
	caCert, err := x509.ParseCertificate(caDER)
	if err != nil {
		return err
	}

	srvKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	srvTmpl := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "kube-apiserver"},
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames: []string{"localhost", "kubernetes", "kubernetes.default", "kubernetes.default.svc",
			"kubernetes.default.svc.cluster.local"},
		IPAddresses: ips,
	}
	srvDER, err := x509.CreateCertificate(rand.Reader, srvTmpl, caCert, &srvKey.PublicKey, caKey)
	if err != nil {
		return err
	}

	saKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return err
	}
	saPub, err := x509.MarshalPKIXPublicKey(&saKey.PublicKey)
	if err != nil {
		return err
	}

	files := map[string]*pem.Block{
		"ca.crt":        {Type: "CERTIFICATE", Bytes: caDER},
		"apiserver.crt": {Type: "CERTIFICATE", Bytes: srvDER},
		"sa.pub":        {Type: "PUBLIC KEY", Bytes: saPub},
	}
	for name, key := range map[string]*ecdsa.PrivateKey{"ca.key": caKey, "apiserver.key": srvKey, "sa.key": saKey} {
		der, err := x509.MarshalECPrivateKey(key)
		if err != nil {
			return err
		}
		files[name] = &pem.Block{Type: "EC PRIVATE KEY", Bytes: der}
	}
	for name, block := range files {
		if err := os.WriteFile(filepath.Join(dir, name), pem.EncodeToMemory(block), 0o600); err != nil {
			return err
		}
	}
	return nil
}

// writeAuth writes a static token file for the apiserver and a kubeconfig
// for the in-process clients. The kubeconfig carries no credentials:
// client-go only sends them over TLS, and the plain listener adds the
// admin token itself (see plainHandler). The admin user is a member of
// system:masters, so RBAC grants it everything.
func writeAuth(dir, server string) (kubeconfig, token string, err error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	token = hex.EncodeToString(raw)
	if err := os.WriteFile(filepath.Join(dir, "tokens.csv"), []byte(token+",admin,admin,\"system:masters\"\n"), 0o600); err != nil {
		return "", "", err
	}
	kubeconfig = filepath.Join(dir, "admin.kubeconfig")
	cfg := fmt.Sprintf(`apiVersion: v1
kind: Config
clusters:
- name: kube-wasm
  cluster:
    server: %s
users:
- name: admin
  user: {}
contexts:
- name: kube-wasm
  context:
    cluster: kube-wasm
    user: admin
    namespace: default
current-context: kube-wasm
`, server)
	return kubeconfig, token, os.WriteFile(kubeconfig, []byte(cfg), 0o600)
}
