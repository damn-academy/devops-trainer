package lab

import (
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/provider/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

const (
	defaultEndpoint   = "http://api.cloud.lab/v1"
	defaultS3Endpoint = "http://s3.cloud.lab"
)

type labProvider struct{ version string }

// New returns the provider factory for providerserver.Serve.
func New(version string) func() provider.Provider {
	return func() provider.Provider { return &labProvider{version: version} }
}

type providerModel struct {
	Endpoint   types.String `tfsdk:"endpoint"`
	S3Endpoint types.String `tfsdk:"s3_endpoint"`
	Token      types.String `tfsdk:"token"`
	Project    types.String `tfsdk:"project"`
	Timeout    types.Int64  `tfsdk:"operation_timeout"`
}

func (p *labProvider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
	resp.TypeName = "lab"
	resp.Version = p.version
}

func (p *labProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "The in-tab cloud of DevOps Trainer: every lab_vm is a real Linux machine emulated in the browser tab.",
		Attributes: map[string]schema.Attribute{
			"endpoint":          schema.StringAttribute{Optional: true, Description: "API base URL. Default: LAB_ENDPOINT or " + defaultEndpoint + "."},
			"s3_endpoint":       schema.StringAttribute{Optional: true, Description: "Object storage URL. Default: LAB_S3_ENDPOINT or " + defaultS3Endpoint + "."},
			"token":             schema.StringAttribute{Optional: true, Sensitive: true, Description: "Secret of an access key. Default: LAB_TOKEN."},
			"project":           schema.StringAttribute{Optional: true, Description: "Project name or id. Default: LAB_PROJECT or default."},
			"operation_timeout": schema.Int64Attribute{Optional: true, Description: "Seconds to wait for one slow operation such as a VM boot. Default: 900."},
		},
	}
}

func envOr(v types.String, env, def string) string {
	if !v.IsNull() && !v.IsUnknown() && v.ValueString() != "" {
		return v.ValueString()
	}
	if s := os.Getenv(env); s != "" {
		return s
	}
	return def
}

func (p *labProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
	var m providerModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	endpoint := strings.TrimRight(envOr(m.Endpoint, "LAB_ENDPOINT", defaultEndpoint), "/")
	if !strings.HasSuffix(endpoint, "/v1") {
		endpoint += "/v1"
	}
	timeout := 900 * time.Second
	if !m.Timeout.IsNull() && !m.Timeout.IsUnknown() && m.Timeout.ValueInt64() > 0 {
		timeout = time.Duration(m.Timeout.ValueInt64()) * time.Second
	}
	c := &Client{
		Endpoint:   endpoint,
		S3Endpoint: strings.TrimRight(envOr(m.S3Endpoint, "LAB_S3_ENDPOINT", defaultS3Endpoint), "/"),
		Token:      envOr(m.Token, "LAB_TOKEN", ""),
		Project:    envOr(m.Project, "LAB_PROJECT", "default"),
		// Long polls of operations last up to 30 s.
		HTTP:      &http.Client{Timeout: 75 * time.Second},
		OpTimeout: timeout,
	}
	if c.Token == "" {
		resp.Diagnostics.AddAttributeError(path.Root("token"), "Missing token",
			"Set token in the provider block or the LAB_TOKEN environment variable to the secret of an access key of the lab cloud.")
		return
	}
	resp.ResourceData = c
	resp.DataSourceData = c
}

func (p *labProvider) Resources(context.Context) []func() resource.Resource {
	return []func() resource.Resource{
		func() resource.Resource { return &networkResource{} },
		func() resource.Resource { return &subnetResource{} },
		func() resource.Resource { return &securityGroupResource{} },
		func() resource.Resource { return &sshKeyResource{} },
		func() resource.Resource { return &vmResource{} },
		func() resource.Resource { return &diskResource{} },
		func() resource.Resource { return &dnsZoneResource{} },
		func() resource.Resource { return &dnsRecordResource{} },
		func() resource.Resource { return &lbResource{} },
		func() resource.Resource { return &bucketResource{} },
		func() resource.Resource { return &objectResource{} },
	}
}

func (p *labProvider) DataSources(context.Context) []func() datasource.DataSource {
	return []func() datasource.DataSource{
		func() datasource.DataSource { return &imagesDataSource{} },
		func() datasource.DataSource { return &flavorsDataSource{} },
		func() datasource.DataSource { return &networkDataSource{} },
		func() datasource.DataSource { return &subnetDataSource{} },
	}
}
