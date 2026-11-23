// Command terraform-provider-lab is the Terraform/OpenTofu provider for the
// in-tab cloud of DevOps Trainer (api.cloud.lab, see
// web/src/engine/cloud/openapi.yaml). It runs inside the lab machines
// (linux/386) and on a workstation alike.
package main

import (
	"context"
	"flag"
	"log"

	"github.com/hashicorp/terraform-plugin-framework/providerserver"

	"github.com/damn-academy/devops-trainer/tools/terraform-provider-lab/internal/lab"
)

// version is set at build time with -ldflags "-X main.version=...".
var version = "dev"

func main() {
	debug := flag.Bool("debug", false, "run the provider for debuggers (prints TF_REATTACH_PROVIDERS)")
	flag.Parse()
	err := providerserver.Serve(context.Background(), lab.New(version), providerserver.ServeOpts{
		Address: "registry.opentofu.org/lab/lab",
		Debug:   *debug,
	})
	if err != nil {
		log.Fatal(err)
	}
}
