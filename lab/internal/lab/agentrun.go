package lab

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/tym83/devops-trainer/lab/internal/agent"
	"github.com/tym83/devops-trainer/lab/internal/backend"
	"github.com/tym83/devops-trainer/lab/internal/hostinfo"
	"github.com/tym83/devops-trainer/lab/internal/labdhcp"
	"github.com/tym83/devops-trainer/lab/internal/netstack"
	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// RunAgent is `dtlab agent` (and `dtlab serve` in the foreground): the lab
// network for QEMU VMs and the local web server, until ctx ends.
func (lab *Lab) RunAgent(ctx context.Context, course string, allow []string) error {
	st, err := lab.State()
	if err != nil {
		return err
	}
	if st.AgentPort == 0 {
		st.AgentPort, st.SwitchPort = AgentPort, SwitchPort
	}
	if course == "" {
		course = st.CourseDir
	}
	if course == "" {
		if _, err := os.Stat(filepath.Join(lab.L.Course(), "index.html")); err == nil {
			course = lab.L.Course()
		}
	}
	if st.Backend.Name == "qemu" && len(st.VMs) > 0 {
		sw, err := netstack.Start(ctx, netstack.Config(st.Plain()), "127.0.0.1:"+strconv.Itoa(st.SwitchPort))
		if err != nil {
			return err
		}
		defer sw.Close()
		lab.Log("lab network %s on %s", profile.Subnet, sw.Addr())
	}
	if st.Backend.Name == "qemu" && st.Backend.Accel == "whpx" {
		for _, v := range st.VMs {
			go lab.restartOnReboot(ctx, v.Name)
		}
	}
	srv := &agent.Server{
		Port: st.AgentPort, CourseDir: course, FilesDir: lab.L.Files(), AllowOrigins: allow,
		Seed: func(vm, file string) (string, bool) {
			cur, err := lab.State()
			if err != nil {
				return "", false
			}
			v := cur.VM(vm)
			if v == nil || v.Kind == profile.Kuberoot {
				return "", false
			}
			s, err := lab.Seed(cur, v.VM, false)
			if err != nil {
				return "", false
			}
			switch file {
			case "meta-data":
				return s.MetaData, true
			case "user-data":
				return s.UserData, true
			case "vendor-data":
				return "", true
			case "network-config":
				return s.NetworkConfig, s.NetworkConfig != ""
			}
			return "", false
		},
		Status: func(ctx context.Context) any {
			sv, err := lab.Status(ctx)
			if err != nil {
				return map[string]string{"error": err.Error()}
			}
			sv.Agent = true
			return sv
		},
		Facts: func(ctx context.Context, r agent.FactsRequest) (string, error) {
			return lab.Facts(ctx, r.VM, r.Request)
		},
	}
	ln, err := agent.Listen(st.AgentPort)
	if err != nil {
		return err
	}
	hs := &http.Server{Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	if st.Backend.Name == "hyperv" && len(st.VMs) > 0 {
		// The switch's addresses are new and stay "tentative" for a few
		// seconds (duplicate address detection): until then nothing can
		// bind them, so both listeners are retried.
		go retryBind(ctx, lab.Log, "DHCP on the lab switch", func() error { return lab.serveDHCP(ctx, st) })
		go retryBind(ctx, lab.Log, "the agent for the VMs", func() error {
			vln, err := agent.ListenVMs(st.AgentPort)
			if err != nil {
				return err
			}
			go func() { _ = hs.Serve(vln) }()
			lab.Log("agent for the VMs on %s:%d", profile.HostIP, st.AgentPort)
			return nil
		})
	}
	go func() {
		<-ctx.Done()
		c, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = hs.Shutdown(c)
	}()
	if course != "" {
		lab.Log("course: http://127.0.0.1:%d/ (from %s)", st.AgentPort, course)
	} else {
		lab.Log("agent on http://127.0.0.1:%d/ (no course copy: pass --course web/dist)", st.AgentPort)
	}
	if err := hs.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("agent: %w", err)
	}
	return nil
}

// serveDHCP answers DHCP on Hyper-V's lab switch, which has no DHCP of its
// own, with every VM's fixed address and the host as the router.
func (lab *Lab) serveDHCP(ctx context.Context, st *State) error {
	conn, err := net.ListenPacket("udp4", net.JoinHostPort(profile.Gateway, "67"))
	if err != nil {
		return err
	}
	c := labdhcp.Config{Leases: map[string]net.IP{}, Server: net.ParseIP(profile.Gateway).To4(),
		Mask: net.CIDRMask(profile.Prefix, 32), Lease: 24 * 3600,
		DNS: []net.IP{net.ParseIP("1.1.1.1").To4(), net.ParseIP("8.8.8.8").To4()},
		MTU: hostinfo.UplinkMTU()}
	for _, v := range st.VMs {
		c.Leases[strings.ToLower(v.MAC)] = net.ParseIP(v.IP).To4()
	}
	go func() {
		if err := c.Serve(ctx, conn, lab.Log); err != nil {
			lab.Log("dhcp: %v", err)
		}
	}()
	if c.MTU > 0 {
		lab.Log("DHCP for the lab VMs on %s:67, MTU %d (the host's uplink)", profile.Gateway, c.MTU)
	} else {
		lab.Log("DHCP for the lab VMs on %s:67 (the host's uplink MTU is unknown: none offered)", profile.Gateway)
	}
	return nil
}

// restartOnReboot starts a VM again when its guest reboots. Under WHPX QEMU
// powers off instead of resetting (see backend.QEMU.Args), so a reboot of
// the learner VM, or kuberoot's reboot into its installed system, would
// otherwise leave the VM off.
func (lab *Lab) restartOnReboot(ctx context.Context, name string) {
	wait := func(d time.Duration) bool {
		select {
		case <-ctx.Done():
			return false
		case <-time.After(d):
			return true
		}
	}
	for {
		st, err := lab.State()
		if err != nil {
			return
		}
		v := st.VM(name)
		if v == nil {
			return
		}
		if v.Status.PID == 0 || !lab.R.Alive(v.Status.PID) {
			if !wait(2 * time.Second) {
				return
			}
			continue
		}
		reset, err := backend.WatchReset(ctx, backend.EventsPort(v.VM))
		if err != nil || !reset {
			if !wait(2 * time.Second) {
				return
			}
			continue
		}
		for lab.R.Alive(v.Status.PID) {
			if !wait(200 * time.Millisecond) {
				return
			}
		}
		be, err := lab.Backend(st)
		if err != nil {
			lab.Log("%s rebooted and cannot be started again: %v", name, err)
			return
		}
		s, err := be.Start(ctx, v.VM, v.Disks)
		if err != nil {
			lab.Log("%s rebooted and cannot be started again: %v", name, err)
			continue
		}
		if cur, err := lab.State(); err == nil {
			if cv := cur.VM(name); cv != nil {
				cv.Status = s
				_ = cur.Save(lab.L.State())
			}
		}
		lab.Log("%s rebooted: started again (pid %d)", name, s.PID)
	}
}

// retryBind runs listen until it succeeds or ctx ends, every two seconds,
// saying once that it waits.
func retryBind(ctx context.Context, log func(string, ...any), what string, listen func() error) {
	for i := 0; ; i++ {
		err := listen()
		if err == nil {
			return
		}
		if i == 0 {
			log("%s: %v; trying again until the address is ready", what, err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
	}
}
