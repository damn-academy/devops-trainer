package hostinfo

import "net"

// The MTUs worth handing on: 576 is the smallest every IPv4 host must take
// (RFC 791, and the floor RFC 2132 sets for DHCP option 26), 9000 a jumbo
// frame. Anything else is a reading gone wrong.
const (
	minMTU = 576
	maxMTU = 9000
)

// uplinkProbe is an address on the internet; dialling it over UDP only
// asks the routing table which local address it would leave from. Nothing
// is sent.
var uplinkProbe = "1.1.1.1:53"

// UplinkMTU is the MTU of the interface this computer reaches the internet
// through: a VPN, PPPoE or a nested VM's network card is below 1500, and the
// lab's VMs behind the host's NAT must not send larger packets than it
// does. 0 when it cannot be told.
func UplinkMTU() int {
	conn, err := net.Dial("udp4", uplinkProbe)
	if err != nil {
		return 0
	}
	local := conn.LocalAddr().(*net.UDPAddr).IP
	conn.Close()
	ifaces, err := net.Interfaces()
	if err != nil {
		return 0
	}
	var links []link
	for _, i := range ifaces {
		addrs, err := i.Addrs()
		if err != nil {
			continue
		}
		l := link{mtu: i.MTU}
		for _, a := range addrs {
			if n, ok := a.(*net.IPNet); ok {
				l.addrs = append(l.addrs, n.IP)
			}
		}
		links = append(links, l)
	}
	return mtuOf(local, links)
}

// link is what UplinkMTU needs of an interface.
type link struct {
	mtu   int
	addrs []net.IP
}

// mtuOf is the MTU of the link holding local, when it is a sane one.
func mtuOf(local net.IP, links []link) int {
	for _, l := range links {
		for _, a := range l.addrs {
			if a.Equal(local) {
				if l.mtu < minMTU || l.mtu > maxMTU {
					return 0
				}
				return l.mtu
			}
		}
	}
	return 0
}
