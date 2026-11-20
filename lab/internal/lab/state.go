package lab

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/tym83/devops-trainer/lab/internal/backend"
	"github.com/tym83/devops-trainer/lab/internal/profile"
)

// State is what `up` made, kept at <root>/state.json.
type State struct {
	Profile    string         `json:"profile"`
	Parts      []string       `json:"parts"`
	Backend    backend.Choice `json:"backend"`
	Arch       string         `json:"arch"`
	AgentPort  int            `json:"agentPort"`
	SwitchPort int            `json:"switchPort"`
	AgentPID   int            `json:"agentPID,omitempty"`
	CourseDir  string         `json:"courseDir,omitempty"`
	VMs        []VMState      `json:"vms"`
}

// VMState is one VM and where it is.
type VMState struct {
	profile.VM
	Status backend.Status `json:"status"`
	Disks  backend.Disks  `json:"disks"`
	// Installed: kuberoot runs from its system disk.
	Installed bool `json:"installed,omitempty"`
}

// VM finds a VM by name.
func (s *State) VM(name string) *VMState {
	for i := range s.VMs {
		if s.VMs[i].Name == name {
			return &s.VMs[i]
		}
	}
	return nil
}

// Plain returns the profile VMs.
func (s *State) Plain() []profile.VM {
	out := make([]profile.VM, len(s.VMs))
	for i, v := range s.VMs {
		out[i] = v.VM
	}
	return out
}

// LoadState reads the state; none is an empty state.
func LoadState(path string) (*State, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return &State{}, nil
	}
	if err != nil {
		return nil, err
	}
	var s State
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, err
	}
	return &s, nil
}

// Save writes the state atomically.
func (s *State) Save(path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(path+".tmp", raw, 0o600); err != nil {
		return err
	}
	return os.Rename(path+".tmp", path)
}
