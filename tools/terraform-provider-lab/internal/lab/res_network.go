package lab

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/booldefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/boolplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/listplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// readInto reads a resource by id; a 404 removes it from the state (drift: deleted outside).
func readInto(ctx context.Context, c *Client, p string, out any, resp *resource.ReadResponse) bool {
	if err := c.Get(ctx, p, out); err != nil {
		if IsNotFound(err) {
			resp.State.RemoveResource(ctx)
			return false
		}
		addErr(&resp.Diagnostics, "read "+p, err)
		return false
	}
	return true
}

func importID(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resource.ImportStatePassthroughID(ctx, path.Root("id"), req, resp)
}

// ── lab_network ──

type networkAPI struct {
	meta
	CIDR    string `json:"cidr"`
	VLAN    int64  `json:"vlan"`
	Default bool   `json:"default"`
	Status  string `json:"status"`
}

type networkModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
	CIDR        types.String `tfsdk:"cidr"`
	VLAN        types.Int64  `tfsdk:"vlan"`
	Status      types.String `tfsdk:"status"`
}

func (m *networkModel) set(a networkAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.CIDR, m.VLAN, m.Status = types.StringValue(a.CIDR), types.Int64Value(a.VLAN), types.StringValue(a.Status)
}

type networkResource struct{ base }

var (
	_ resource.ResourceWithConfigure   = &networkResource{}
	_ resource.ResourceWithImportState = &networkResource{}
)

func (r *networkResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_network"
}

func (r *networkResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "A network: one 802.1Q VLAN on the switch of the tab; the lab host routes between its subnets.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("network"),
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"cidr": schema.StringAttribute{Optional: true, Computed: true, Description: "Inside 10.0.0.0/8, e.g. 10.10.0.0/16. Default: the next free 10.N.0.0/16.",
				PlanModifiers: []planmodifier.String{stringplanmodifier.RequiresReplace(), stringplanmodifier.UseStateForUnknown()}},
			"vlan":   schema.Int64Attribute{Computed: true, Description: "VLAN id on the switch.", PlanModifiers: []planmodifier.Int64{int64planmodifier.UseStateForUnknown()}},
			"status": schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
		},
	}
}

func (r *networkResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m networkModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics)}
	if !m.CIDR.IsUnknown() && !m.CIDR.IsNull() {
		body["cidr"] = m.CIDR.ValueString()
	}
	var a networkAPI
	if err := r.c.Create(ctx, r.c.P("networks"), body, &a); err != nil {
		addErr(&resp.Diagnostics, "create network", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *networkResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m networkModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a networkAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("networks", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *networkResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m networkModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a networkAPI
	body := map[string]any{"description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics)}
	if err := r.c.Patch(ctx, r.c.P("networks", m.ID.ValueString()), body, &a); err != nil {
		addErr(&resp.Diagnostics, "update network", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *networkResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m networkModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("networks", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete network", err)
	}
}

func (r *networkResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}

// ── lab_subnet ──

type subnetAPI struct {
	meta
	NetworkID    string   `json:"network_id"`
	CIDR         string   `json:"cidr"`
	Gateway      string   `json:"gateway"`
	DHCP         bool     `json:"dhcp"`
	DNSServers   []string `json:"dns_servers"`
	AvailableIPs int64    `json:"available_ips"`
	Status       string   `json:"status"`
}

type subnetModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
	NetworkID   types.String `tfsdk:"network_id"`
	CIDR        types.String `tfsdk:"cidr"`
	Gateway     types.String `tfsdk:"gateway"`
	DHCP        types.Bool   `tfsdk:"dhcp"`
	DNSServers  types.List   `tfsdk:"dns_servers"`
	Status      types.String `tfsdk:"status"`
}

func (m *subnetModel) set(ctx context.Context, c *Client, a subnetAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.NetworkID = c.keepRef(ctx, "networks", m.NetworkID, a.NetworkID)
	m.CIDR, m.Gateway, m.DHCP, m.Status = types.StringValue(a.CIDR), types.StringValue(a.Gateway), types.BoolValue(a.DHCP), types.StringValue(a.Status)
	m.DNSServers = fromList(a.DNSServers)
}

type subnetResource struct{ base }

func (r *subnetResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_subnet"
}

func (r *subnetResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "A subnet of a network. The first address is the gateway; the lab host answers DHCP and DNS there.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("subnet"),
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"network_id":  schema.StringAttribute{Required: true, Description: "Network id or name.", PlanModifiers: requiresReplace()},
			"cidr":        schema.StringAttribute{Required: true, Description: "/16 to /29 inside the network, e.g. 10.10.1.0/24.", PlanModifiers: requiresReplace()},
			"gateway":     schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
			"dhcp": schema.BoolAttribute{Optional: true, Computed: true, Default: booldefault.StaticBool(true),
				PlanModifiers: []planmodifier.Bool{boolplanmodifier.RequiresReplace()}},
			"dns_servers": schema.ListAttribute{ElementType: types.StringType, Optional: true, Computed: true, Description: "Default: the gateway (lab DNS).",
				PlanModifiers: []planmodifier.List{listplanmodifier.RequiresReplace(), listplanmodifier.UseStateForUnknown()}},
			"status": schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
		},
	}
}

func (r *subnetResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m subnetModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	body := map[string]any{
		"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics),
		"network_id": m.NetworkID.ValueString(), "cidr": m.CIDR.ValueString(), "dhcp": m.DHCP.ValueBool(),
	}
	if !m.DNSServers.IsUnknown() && !m.DNSServers.IsNull() {
		body["dns_servers"] = toStrings(ctx, m.DNSServers, &resp.Diagnostics)
	}
	var a subnetAPI
	if err := r.c.Create(ctx, r.c.P("subnets"), body, &a); err != nil {
		addErr(&resp.Diagnostics, "create subnet", err)
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *subnetResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m subnetModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a subnetAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("subnets", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *subnetResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m subnetModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a subnetAPI
	body := map[string]any{"description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics)}
	if err := r.c.Patch(ctx, r.c.P("subnets", m.ID.ValueString()), body, &a); err != nil {
		addErr(&resp.Diagnostics, "update subnet", err)
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *subnetResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m subnetModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("subnets", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete subnet", err)
	}
}

func (r *subnetResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}

// ── lab_ssh_key ──

type sshKeyAPI struct {
	meta
	PublicKey   string `json:"public_key"`
	Fingerprint string `json:"fingerprint"`
}

type sshKeyModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
	PublicKey   types.String `tfsdk:"public_key"`
	Fingerprint types.String `tfsdk:"fingerprint"`
}

func (m *sshKeyModel) set(a sshKeyAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.PublicKey, m.Fingerprint = types.StringValue(a.PublicKey), types.StringValue(a.Fingerprint)
}

type sshKeyResource struct{ base }

func (r *sshKeyResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_ssh_key"
}

func (r *sshKeyResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "An OpenSSH public key that VMs of the project can get on first boot (ssh_key_ids).",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("key"),
			"description": replaceOnChange(descriptionAttr()),
			"labels":      replaceMapOnChange(labelsAttr()),
			"public_key":  schema.StringAttribute{Required: true, Description: "e.g. the content of ~/.ssh/id_ed25519.pub.", PlanModifiers: requiresReplace()},
			"fingerprint": schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
		},
	}
}

func (r *sshKeyResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m sshKeyModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a sshKeyAPI
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics), "public_key": m.PublicKey.ValueString()}
	if err := r.c.Create(ctx, r.c.P("ssh-keys"), body, &a); err != nil {
		addErr(&resp.Diagnostics, "create ssh key", err)
		return
	}
	// The API may trim a trailing newline of the key file; keep what the configuration says.
	pk := m.PublicKey
	m.set(a)
	m.PublicKey = pk
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *sshKeyResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m sshKeyModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a sshKeyAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("ssh-keys", m.ID.ValueString()), &a, resp) {
		return
	}
	pk := m.PublicKey
	m.set(a)
	if !pk.IsNull() && trimKey(pk.ValueString()) == trimKey(a.PublicKey) {
		m.PublicKey = pk
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func trimKey(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r' || s[len(s)-1] == ' ') {
		s = s[:len(s)-1]
	}
	return s
}

// Update is never planned: the API has no PATCH for keys, every attribute replaces the key.
func (r *sshKeyResource) Update(_ context.Context, _ resource.UpdateRequest, resp *resource.UpdateResponse) {
	resp.Diagnostics.AddError("lab: ssh keys cannot be changed in place", "The cloud keeps ssh keys as they were created.")
}

func (r *sshKeyResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m sshKeyModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("ssh-keys", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete ssh key", err)
	}
}

func (r *sshKeyResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}
