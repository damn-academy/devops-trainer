/*
Copyright 2026 The damn.academy Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	_ "unsafe" // go:linkname

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"k8s.io/cli-runtime/pkg/genericclioptions"
	"k8s.io/cli-runtime/pkg/genericiooptions"
	"k8s.io/client-go/rest"
	kubectlcmd "k8s.io/kubectl/pkg/cmd"
	cmdutil "k8s.io/kubectl/pkg/cmd/util"
)

// kubectlMu serialises invocations: kubectl keeps process-wide state
// (the fatal error handler, the default warning handler).
var kubectlMu sync.Mutex

type kubectlExit struct{ code int }

// cobra keeps every flag that has a completion function in a process-wide
// map, never cleared. A kubectl binary exits after one command; here every
// call built a new command tree, and the map kept all of them alive, with
// the factory and REST mapper their completion functions capture.
//
//go:linkname cobraFlagCompletions github.com/spf13/cobra.flagCompletionFunctions
var cobraFlagCompletions map[*pflag.Flag]cobra.CompletionFunc

//go:linkname cobraFlagCompletionMu github.com/spf13/cobra.flagCompletionMutex
var cobraFlagCompletionMu *sync.RWMutex

func forgetFlagCompletions() {
	cobraFlagCompletionMu.Lock()
	clear(cobraFlagCompletions)
	cobraFlagCompletionMu.Unlock()
}

// Kubectl runs one kubectl command line against the in-process apiserver.
func Kubectl(kubeconfig string, args []string, stdin string) (stdout, stderr string, code int) {
	kubectlMu.Lock()
	defer kubectlMu.Unlock()

	var out, errOut bytes.Buffer
	streams := genericiooptions.IOStreams{In: strings.NewReader(stdin), Out: &out, ErrOut: &errOut}
	// kubectl reads "-f -" from os.Stdin, not from its IOStreams: hand it the
	// input as a file instead.
	if stdin != "" {
		path, cleanup, err := stdinFile(stdin)
		if err != nil {
			return "", err.Error() + "\n", 1
		}
		defer cleanup()
		args = replaceStdinArg(args, path)
	}

	// kubectl reports fatal errors through os.Exit; turn that into a
	// panic carrying the exit code and recover it below.
	cmdutil.BehaviorOnFatal(func(msg string, c int) {
		if msg != "" {
			errOut.WriteString(msg)
			if !strings.HasSuffix(msg, "\n") {
				errOut.WriteString("\n")
			}
		}
		panic(kubectlExit{code: c})
	})
	defer cmdutil.DefaultBehaviorOnFatal()
	// kubectl installs its warning printer as the process-wide default,
	// which the controller-manager and scheduler clients share. Silence it
	// again afterwards, as those components do at start.
	defer rest.SetDefaultWarningHandler(rest.NoWarnings{})
	defer forgetFlagCompletions()

	func() {
		defer func() {
			if r := recover(); r != nil {
				if e, ok := r.(kubectlExit); ok {
					code = e.code
					return
				}
				fmt.Fprintf(&errOut, "kubectl panic: %v\n", r)
				code = 2
			}
		}()
		flags := genericclioptions.NewConfigFlags(true).
			WithDeprecatedPasswordFlag().
			WithDiscoveryBurst(300).
			WithDiscoveryQPS(50.0).
			WithWarningPrinter(streams)
		flags.KubeConfig = &kubeconfig
		cmd := kubectlcmd.NewKubectlCommand(kubectlcmd.KubectlOptions{
			Arguments:   append([]string{"kubectl"}, args...),
			ConfigFlags: flags,
			IOStreams:   streams,
		})
		cmd.SetArgs(args)
		cmd.SetIn(streams.In)
		cmd.SetOut(streams.Out)
		cmd.SetErr(streams.ErrOut)
		if err := cmd.Execute(); err != nil {
			cmdutil.CheckErr(err)
		}
	}()
	return out.String(), errOut.String(), code
}

func stdinFile(data string) (string, func(), error) {
	dir := filepath.Join(os.TempDir(), "kubectl-stdin")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", nil, err
	}
	f, err := os.CreateTemp(dir, "stdin-*.yaml")
	if err != nil {
		return "", nil, err
	}
	defer f.Close()
	if _, err := f.WriteString(data); err != nil {
		return "", nil, err
	}
	return f.Name(), func() { _ = os.Remove(f.Name()) }, nil
}

// replaceStdinArg points -f - / --filename=- at path.
func replaceStdinArg(args []string, path string) []string {
	out := make([]string, 0, len(args))
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case (a == "-f" || a == "--filename") && i+1 < len(args) && args[i+1] == "-":
			out = append(out, a, path)
			i++
		case a == "-f=-" || a == "--filename=-":
			out = append(out, "--filename="+path)
		default:
			out = append(out, a)
		}
	}
	return out
}
