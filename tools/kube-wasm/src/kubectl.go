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
	"strings"
	"sync"

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

// Kubectl runs one kubectl command line against the in-process apiserver.
func Kubectl(kubeconfig string, args []string, stdin string) (stdout, stderr string, code int) {
	kubectlMu.Lock()
	defer kubectlMu.Unlock()

	var out, errOut bytes.Buffer
	streams := genericiooptions.IOStreams{In: strings.NewReader(stdin), Out: &out, ErrOut: &errOut}

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
