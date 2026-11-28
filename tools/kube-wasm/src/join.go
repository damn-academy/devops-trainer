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
	"encoding/json"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"time"
)

// membership is the part of kuberoot's Membership spec
// (node.kuberoot.dev/v1alpha1) a worker needs; kinit reads it from
// /var/lib/kuberoot/membership.json.
type membership struct {
	Role           string `json:"role"`
	Server         string `json:"server"`
	ClusterCA      string `json:"clusterCA"`
	BootstrapToken string `json:"bootstrapToken"`
	NodeAPICert    string `json:"nodeAPICert"`
	NodeAPIKey     string `json:"nodeAPIKey"`
	PodCIDR        string `json:"podCIDR"`
	PodNetwork     string `json:"podNetwork"`
	ServiceCIDR    string `json:"serviceCIDR"`
}

// bootstrapObjects lets a kubelet with the token request its client
// certificate, has the controller-manager approve it (and its renewals), as
// kubeadm sets up.
const bootstrapObjects = `apiVersion: v1
kind: Secret
metadata:
  name: bootstrap-token-%[1]s
  namespace: kube-system
type: bootstrap.kubernetes.io/token
stringData:
  token-id: %[1]s
  token-secret: %[2]s
  expiration: %[3]s
  usage-bootstrap-authentication: "true"
  usage-bootstrap-signing: "true"
  auth-extra-groups: system:bootstrappers:kube-wasm
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-wasm:node-bootstrapper
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: system:node-bootstrapper}
subjects: [{apiGroup: rbac.authorization.k8s.io, kind: Group, name: system:bootstrappers}]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-wasm:node-autoapprove-bootstrap
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: system:certificates.k8s.io:certificatesigningrequests:nodeclient}
subjects: [{apiGroup: rbac.authorization.k8s.io, kind: Group, name: system:bootstrappers}]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-wasm:node-autoapprove-renewal
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: system:certificates.k8s.io:certificatesigningrequests:selfnodeclient}
subjects: [{apiGroup: rbac.authorization.k8s.io, kind: Group, name: system:nodes}]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kube-wasm:kube-proxy
roleRef: {apiGroup: rbac.authorization.k8s.io, kind: ClusterRole, name: system:node-proxier}
subjects: [{apiGroup: rbac.authorization.k8s.io, kind: Group, name: system:nodes}]
`

func randomString(n int) (string, error) {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	for i := range b {
		b[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(b), nil
}

// JoinMembership creates a bootstrap token for one node and returns the
// Membership JSON that makes a kuberoot node a worker of this cluster.
func (c *Cluster) JoinMembership(nodeName, nodeIP string) (string, error) {
	pki := func(f string) string { return filepath.Join(c.opts.PKIDir, f) }
	caPEM, err := os.ReadFile(pki("ca.crt"))
	if err != nil {
		return "", err
	}
	keyPEM, err := os.ReadFile(pki("ca.key"))
	if err != nil {
		return "", err
	}
	caBlock, _ := pem.Decode(caPEM)
	keyBlock, _ := pem.Decode(keyPEM)
	if caBlock == nil || keyBlock == nil {
		return "", fmt.Errorf("cluster CA is not PEM")
	}
	ca, err := x509.ParseCertificate(caBlock.Bytes)
	if err != nil {
		return "", err
	}
	caKey, err := x509.ParseECPrivateKey(keyBlock.Bytes)
	if err != nil {
		return "", err
	}

	id, err := randomString(6)
	if err != nil {
		return "", err
	}
	secret, err := randomString(16)
	if err != nil {
		return "", err
	}
	expires := time.Now().Add(24 * time.Hour).UTC().Format(time.RFC3339)
	if _, errOut, code := Kubectl(c.Kubeconfig, []string{"apply", "-f", "-"}, fmt.Sprintf(bootstrapObjects, id, secret, expires)); code != 0 {
		return "", fmt.Errorf("bootstrap objects: %s", errOut)
	}

	// The node API's certificate: the cluster reaches the node's kuberoot
	// API with it, so it names the node and its address.
	nodeKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return "", err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 62))
	if err != nil {
		return "", err
	}
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{CommonName: nodeName},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		DNSNames:     []string{nodeName},
	}
	if ip := net.ParseIP(nodeIP); ip != nil {
		tmpl.IPAddresses = []net.IP{ip}
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, ca, &nodeKey.PublicKey, caKey)
	if err != nil {
		return "", err
	}
	nodeKeyDER, err := x509.MarshalECPrivateKey(nodeKey)
	if err != nil {
		return "", err
	}

	m := membership{
		Role:           "Worker",
		Server:         "https://" + net.JoinHostPort(advertiseAddr, securePort),
		ClusterCA:      string(caPEM),
		BootstrapToken: id + "." + secret,
		NodeAPICert:    string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})),
		NodeAPIKey:     string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: nodeKeyDER})),
		PodCIDR:        podCIDR,
		PodNetwork:     "host-gw",
		ServiceCIDR:    serviceCIDR,
	}
	out, err := json.Marshal(m)
	return string(out), err
}
