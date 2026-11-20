package hostinfo

import (
	"net"
	"testing"
)

func TestMTUOf(t *testing.T) {
	links := []link{
		{mtu: 65536, addrs: []net.IP{net.ParseIP("127.0.0.1")}},
		{mtu: 1500, addrs: []net.IP{net.ParseIP("10.10.1.1")}},                            // the lab switch
		{mtu: 1400, addrs: []net.IP{net.ParseIP("192.168.5.20"), net.ParseIP("fe80::1")}}, // the uplink
		{mtu: 100, addrs: []net.IP{net.ParseIP("172.16.0.2")}},
	}
	for local, want := range map[string]int{
		"192.168.5.20": 1400,
		"10.10.1.1":    1500,
		"127.0.0.1":    0, // loopback's 64k is no path MTU
		"172.16.0.2":   0, // below the floor
		"203.0.113.9":  0, // on no interface
	} {
		if got := mtuOf(net.ParseIP(local), links); got != want {
			t.Errorf("%s: %d, want %d", local, got, want)
		}
	}
	// An IPv4 address the system lists in its 16-byte form is the same one.
	if got := mtuOf(net.ParseIP("192.168.5.20").To4(), links); got != 1400 {
		t.Errorf("4-byte form: %d", got)
	}
}

func TestUplinkMTURuns(t *testing.T) {
	// Offline, or in a sandbox without a route, it is 0; otherwise sane.
	if got := UplinkMTU(); got != 0 && (got < minMTU || got > maxMTU) {
		t.Errorf("UplinkMTU = %d", got)
	}
}
