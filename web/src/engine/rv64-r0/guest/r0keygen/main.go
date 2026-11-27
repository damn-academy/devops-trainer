// Writes an RSA private key in PEM form: the service-account signing key that
// kube-apiserver needs (the Alpine minirootfs has no openssl).
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
)

func main() {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		panic(err)
	}
	pem.Encode(os.Stdout, &pem.Block{Type: "PRIVATE KEY", Bytes: der})
}
