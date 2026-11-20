package netstack

import (
	"context"
	"strings"
	"testing"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

func TestConfig(t *testing.T) {
	p := profile.Profiles["standard"]
	c := Config(profile.Plan(p, p.Default))
	if c.Subnet != "10.10.1.0/24" || c.GatewayIP != "10.10.1.1" {
		t.Fatal(c.Subnet, c.GatewayIP)
	}
	if c.DHCPStaticLeases["10.10.1.30"] != "52:54:00:d7:01:1e" {
		t.Error("kr-1 lease", c.DHCPStaticLeases)
	}
	if c.Forwards["127.0.0.1:2211"] != "10.10.1.11:22" || c.Forwards["127.0.0.1:50000"] != "10.10.1.30:50000" {
		t.Error(c.Forwards)
	}
	for local := range c.Forwards {
		if !strings.HasPrefix(local, "127.0.0.1:") {
			t.Errorf("%s is not on loopback", local)
		}
	}
	if c.NAT["10.10.1.254"] != "127.0.0.1" {
		t.Error(c.NAT)
	}
	names := map[string]bool{}
	for _, r := range c.DNS[0].Records {
		names[r.Name] = true
	}
	if !names["cp-1"] || !names["kr-1"] || !names["host"] {
		t.Error(names)
	}
}

func TestStartLoopbackOnly(t *testing.T) {
	if _, err := Start(context.Background(), Config(nil), "0.0.0.0:7789"); err == nil {
		t.Fatal("the switch must refuse a non-loopback address")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	s, err := Start(ctx, Config(nil), "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(s.Addr(), "127.0.0.1:") {
		t.Error(s.Addr())
	}
	_ = s.Close()
}
