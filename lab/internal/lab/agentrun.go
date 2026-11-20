package lab

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/tym83/devops-trainer/lab/internal/agent"
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
