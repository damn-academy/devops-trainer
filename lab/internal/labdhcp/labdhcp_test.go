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
