package labdhcp

import (
	"net"
	"testing"

	"github.com/insomniacslk/dhcp/dhcpv4"
)

func cfg() Config {
	return Config{
		Leases: map[string]net.IP{"52:54:00:d7:01:1e": net.ParseIP("10.10.1.30").To4()},
		Server: net.ParseIP("10.10.1.1").To4(), Mask: net.CIDRMask(24, 32),
		DNS: []net.IP{net.ParseIP("1.1.1.1").To4()}, Lease: 86400,
	}
}

func TestOfferAndAck(t *testing.T) {
	mac, _ := net.ParseMAC("52:54:00:D7:01:1E")
	disc, _ := dhcpv4.NewDiscovery(mac)
	offer, err := cfg().Reply(disc)
	if err != nil || offer == nil {
		t.Fatal(offer, err)
	}
	if offer.MessageType() != dhcpv4.MessageTypeOffer || !offer.YourIPAddr.Equal(net.ParseIP("10.10.1.30")) ||
		!offer.Router()[0].Equal(net.ParseIP("10.10.1.1")) || !offer.DNS()[0].Equal(net.ParseIP("1.1.1.1")) ||
		offer.SubnetMask().String() != "ffffff00" || offer.TransactionID != disc.TransactionID {
		t.Fatal(offer.Summary())
	}
	req, _ := dhcpv4.NewRequestFromOffer(offer)
	ack, _ := cfg().Reply(req)
	if ack == nil || ack.MessageType() != dhcpv4.MessageTypeAck || !ack.YourIPAddr.Equal(net.ParseIP("10.10.1.30")) {
		t.Fatal(ack)
	}
}

func TestUnknownAndWrongAddress(t *testing.T) {
	other, _ := net.ParseMAC("52:54:00:00:00:01")
	disc, _ := dhcpv4.NewDiscovery(other)
	if r, _ := cfg().Reply(disc); r != nil {
		t.Error("answered a MAC that is not the lab's")
	}
	mac, _ := net.ParseMAC("52:54:00:d7:01:1e")
	req, _ := dhcpv4.New(dhcpv4.WithHwAddr(mac), dhcpv4.WithMessageType(dhcpv4.MessageTypeRequest),
		dhcpv4.WithOption(dhcpv4.OptRequestedIPAddress(net.ParseIP("10.10.1.99"))))
	if r, _ := cfg().Reply(req); r == nil || r.MessageType() != dhcpv4.MessageTypeNak {
		t.Error("a request for another address must be refused")
	}
}

func mtuOf(t *testing.T, r *dhcpv4.DHCPv4) (uint16, bool) {
	t.Helper()
	if r == nil {
		t.Fatal("no reply")
	}
	if !r.Options.Has(dhcpv4.OptionInterfaceMTU) {
		return 0, false
	}
	mtu, err := dhcpv4.GetUint16(dhcpv4.OptionInterfaceMTU, r.Options)
	if err != nil {
		t.Fatal(err)
	}
	return mtu, true
}

func TestOffersTheUplinkMTU(t *testing.T) {
	mac, _ := net.ParseMAC("52:54:00:d7:01:1e")
	c := cfg()
	c.MTU = 1400
	disc, _ := dhcpv4.NewDiscovery(mac)
	offer, _ := c.Reply(disc)
	if mtu, ok := mtuOf(t, offer); !ok || mtu != 1400 {
		t.Errorf("offer: mtu %d, %v", mtu, ok)
	}
	req, _ := dhcpv4.NewRequestFromOffer(offer)
	ack, _ := c.Reply(req)
	// Through the wire, as the VM reads it.
	ack, err := dhcpv4.FromBytes(ack.ToBytes())
	if err != nil {
		t.Fatal(err)
	}
	if mtu, ok := mtuOf(t, ack); !ok || mtu != 1400 {
		t.Errorf("ack: mtu %d, %v", mtu, ok)
	}
}

func TestOffersNoMTUItCannotVouchFor(t *testing.T) {
	mac, _ := net.ParseMAC("52:54:00:d7:01:1e")
	disc, _ := dhcpv4.NewDiscovery(mac)
	for _, mtu := range []int{0, 575, 9001, 65536} {
		c := cfg()
		c.MTU = mtu
		offer, _ := c.Reply(disc)
		if got, ok := mtuOf(t, offer); ok {
			t.Errorf("MTU %d: offered %d", mtu, got)
		}
	}
	// A refusal carries no configuration at all.
	c := cfg()
	c.MTU = 1400
	req, _ := dhcpv4.New(dhcpv4.WithHwAddr(mac), dhcpv4.WithMessageType(dhcpv4.MessageTypeRequest),
		dhcpv4.WithOption(dhcpv4.OptRequestedIPAddress(net.ParseIP("10.10.1.99"))))
	nak, _ := c.Reply(req)
	if _, ok := mtuOf(t, nak); ok {
		t.Error("a NAK offers an MTU")
	}
}
