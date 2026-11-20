// Package labdhcp is the lab network's DHCP server on Hyper-V, whose
// internal switch has none: every VM gets its fixed address by its MAC,
// with the host as the router (NAT) and public resolvers. With QEMU the lab
// switch in the agent does this itself.
package labdhcp

import (
	"context"
	"errors"
	"net"
	"strings"

	"github.com/insomniacslk/dhcp/dhcpv4"
)

// Config is what the server hands out.
type Config struct {
	Leases map[string]net.IP // MAC (lower case, colons) → address
	Server net.IP            // the host's address on the switch, also the router
	Mask   net.IPMask
	DNS    []net.IP
	Lease  uint32 // seconds
	// MTU is offered as the interface MTU (option 26): the MTU of the
	// host's uplink, since Hyper-V's NAT forwards the VMs' packets as they
	// are and one larger than the uplink takes is dropped (TLS from the VM
	// hangs). 0, or a value outside 576-9000, offers none.
	MTU int
}

// The MTUs worth offering: RFC 2132's floor for option 26, and a jumbo frame.
const (
	minMTU = 576
	maxMTU = 9000
)

// Reply answers a DISCOVER with an OFFER and a REQUEST with an ACK for the
// VM's own address; anything else, or an unknown MAC, gets no answer.
func (c Config) Reply(req *dhcpv4.DHCPv4) (*dhcpv4.DHCPv4, error) {
	if req.OpCode != dhcpv4.OpcodeBootRequest {
		return nil, nil
	}
	ip, ok := c.Leases[strings.ToLower(req.ClientHWAddr.String())]
	if !ok {
		return nil, nil
	}
	var t dhcpv4.MessageType
	switch req.MessageType() {
	case dhcpv4.MessageTypeDiscover:
		t = dhcpv4.MessageTypeOffer
	case dhcpv4.MessageTypeRequest:
		if want := req.RequestedIPAddress(); want != nil && !want.IsUnspecified() && !want.Equal(ip) {
			t = dhcpv4.MessageTypeNak
		} else {
			t = dhcpv4.MessageTypeAck
		}
	default:
		return nil, nil
	}
	mods := []dhcpv4.Modifier{
		dhcpv4.WithMessageType(t),
		dhcpv4.WithServerIP(c.Server),
		dhcpv4.WithOption(dhcpv4.OptServerIdentifier(c.Server)),
	}
	if t != dhcpv4.MessageTypeNak {
		mods = append(mods,
			dhcpv4.WithYourIP(ip),
			dhcpv4.WithNetmask(c.Mask),
			dhcpv4.WithOption(dhcpv4.OptRouter(c.Server)),
			dhcpv4.WithOption(dhcpv4.OptDNS(c.DNS...)),
			dhcpv4.WithLeaseTime(c.Lease))
		if c.MTU >= minMTU && c.MTU <= maxMTU {
			mods = append(mods, dhcpv4.WithOption(dhcpv4.Option{Code: dhcpv4.OptionInterfaceMTU, Value: dhcpv4.Uint16(c.MTU)}))
		}
	}
	return dhcpv4.NewReplyFromRequest(req, mods...)
}

// Serve answers on conn (UDP port 67 on the host's switch address) until
// ctx ends, broadcasting the replies: the VM has no address yet.
func (c Config) Serve(ctx context.Context, conn net.PacketConn, log func(string, ...any)) error {
	go func() { <-ctx.Done(); conn.Close() }()
	buf := make([]byte, 1500)
	to := &net.UDPAddr{IP: net.IPv4bcast, Port: dhcpv4.ClientPort}
	for {
		n, _, err := conn.ReadFrom(buf)
		if err != nil {
			if ctx.Err() != nil || errors.Is(err, net.ErrClosed) {
				return nil
			}
			return err
		}
		req, err := dhcpv4.FromBytes(buf[:n])
		if err != nil {
			continue
		}
		resp, err := c.Reply(req)
		if err != nil || resp == nil {
			continue
		}
		if _, err := conn.WriteTo(resp.ToBytes(), to); err != nil {
			log("dhcp: %v", err)
		}
	}
}
