// Package netstack is the lab network for the QEMU backend: a virtual
// switch in the dtlab agent process (gvisor-tap-vsock, the network of podman
// machine) with a gateway that gives every VM its fixed address by DHCP,
// answers DNS for the lab's names, NATs to the internet, and publishes
// chosen VM ports on the host's loopback only.
//
// Every VM has one network card, connected to the agent over a loopback TCP
// socket (QEMU `-netdev stream`), so the same code runs on Linux, macOS and
// Windows without root, bridges or TAP devices, and nothing is left on the
// host when the agent stops.
package netstack

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"strconv"
	"sync"

	"github.com/containers/gvisor-tap-vsock/pkg/types"
	"github.com/containers/gvisor-tap-vsock/pkg/virtualnetwork"

	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// GatewayMAC of the virtual gateway.
const GatewayMAC = "5a:94:ef:e4:0c:dd"

// Config builds the virtual network's configuration from the lab's VMs.
func Config(vms []profile.VM) *types.Configuration {
	leases := map[string]string{}
	records := []types.Record{{Name: "gateway", IP: net.ParseIP(profile.Gateway)}, {Name: "host", IP: net.ParseIP(profile.HostIP)}, {Name: "dtlab", IP: net.ParseIP(profile.HostIP)}}
	fwd := map[string]string{}
	for _, v := range vms {
		leases[v.IP] = v.MAC
		records = append(records, types.Record{Name: v.Name, IP: net.ParseIP(v.IP)})
		if v.SSHPort > 0 {
			fwd[loopback(v.SSHPort)] = net.JoinHostPort(v.IP, "22")
		}
		for _, f := range v.Forwards {
			fwd[loopback(f.Host)] = net.JoinHostPort(v.IP, strconv.Itoa(f.Guest))
		}
	}
	return &types.Configuration{
		// Offered to the VMs by DHCP (option 26). 1500 whatever the host's
		// uplink: the VMs' connections end in the agent, which opens its own
		// sockets on the host, so the host's MTU applies there, not here.
		MTU:               1500,
		Subnet:            profile.Subnet,
		GatewayIP:         profile.Gateway,
		GatewayMacAddress: GatewayMAC,
		DHCPStaticLeases:  leases,
		DNS:               []types.Zone{{Name: "lab.", Records: records}},
		DNSSearchDomains:  []string{"lab"},
		Forwards:          fwd,
		// HostIP is the host's 127.0.0.1 as the VMs see it: the agent, the
		// course and the image cache, without opening anything beyond loopback.
		NAT:               map[string]string{profile.HostIP: "127.0.0.1"},
		GatewayVirtualIPs: []string{profile.HostIP},
		Protocol:          types.QemuProtocol,
	}
}

// Every published port binds 127.0.0.1: nothing of the lab is reachable
// from the learner's network.
func loopback(port int) string { return net.JoinHostPort("127.0.0.1", strconv.Itoa(port)) }

// Switch runs the network and accepts the VMs' QEMU connections.
type Switch struct {
	vn *virtualnetwork.VirtualNetwork
	ln net.Listener
	wg sync.WaitGroup
}

// Start brings the network up and listens for VMs on listen (127.0.0.1:port).
func Start(ctx context.Context, cfg *types.Configuration, listen string) (*Switch, error) {
	host, _, err := net.SplitHostPort(listen)
	if err != nil {
		return nil, err
	}
	if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
		return nil, fmt.Errorf("the lab switch listens on loopback only, not %s", listen)
	}
	vn, err := virtualnetwork.New(cfg)
	if err != nil {
		return nil, fmt.Errorf("lab network: %w", err)
	}
	ln, err := net.Listen("tcp", listen)
	if err != nil {
		return nil, err
	}
	s := &Switch{vn: vn, ln: ln}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		for {
			c, err := ln.Accept()
			if err != nil {
				if !errors.Is(err, net.ErrClosed) {
					log.Printf("switch: %v", err)
				}
				return
			}
			go func() {
				if err := vn.AcceptQemu(ctx, c); err != nil && ctx.Err() == nil {
					log.Printf("switch: VM link closed: %v", err)
				}
			}()
		}
	}()
	return s, nil
}

// Addr is where VMs connect.
func (s *Switch) Addr() string { return s.ln.Addr().String() }

// Close stops accepting VMs.
func (s *Switch) Close() error {
	err := s.ln.Close()
	s.wg.Wait()
	return err
}
