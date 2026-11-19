package lab

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/datasource"
	"github.com/hashicorp/terraform-plugin-framework/datasource/schema"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

type dsBase struct{ base }

func (b *dsBase) Configure(_ context.Context, req datasource.ConfigureRequest, resp *datasource.ConfigureResponse) {
	b.configure(req.ProviderData, &resp.Diagnostics)
}

// ── lab_images ──

type imageAPI struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	OS          string `json:"os"`
	MinMemoryMB int64  `json:"min_memory_mb"`
	SSH         bool   `json:"ssh"`
	CloudInit   bool   `json:"cloud_init"`
}

type imageModel struct {
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	OS          types.String `tfsdk:"os"`
	MinMemoryMB types.Int64  `tfsdk:"min_memory_mb"`
	SSH         types.Bool   `tfsdk:"ssh"`
	CloudInit   types.Bool   `tfsdk:"cloud_init"`
}

type imagesModel struct {
	Names  types.List   `tfsdk:"names"`
	Images []imageModel `tfsdk:"images"`
}

type imagesDataSource struct{ dsBase }

func (d *imagesDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_images"
}

func (d *imagesDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Images the VM backend of this tab can boot.",
		Attributes: map[string]schema.Attribute{
			"names": schema.ListAttribute{ElementType: types.StringType, Computed: true},
			"images": schema.ListNestedAttribute{Computed: true, NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
				"name":          schema.StringAttribute{Computed: true},
				"description":   schema.StringAttribute{Computed: true},
				"os":            schema.StringAttribute{Computed: true},
				"min_memory_mb": schema.Int64Attribute{Computed: true},
				"ssh":           schema.BoolAttribute{Computed: true, Description: "The image runs sshd."},
				"cloud_init":    schema.BoolAttribute{Computed: true, Description: "The image reads metadata (keys, user data) on boot."},
			}}},
		},
	}
}

func (d *imagesDataSource) Read(ctx context.Context, _ datasource.ReadRequest, resp *datasource.ReadResponse) {
	items, err := List[imageAPI](ctx, d.c, "/images")
	if err != nil {
		addErr(&resp.Diagnostics, "list images", err)
		return
	}
	var m imagesModel
	names := make([]string, len(items))
	for i, x := range items {
		names[i] = x.Name
		m.Images = append(m.Images, imageModel{types.StringValue(x.Name), types.StringValue(x.Description), types.StringValue(x.OS), types.Int64Value(x.MinMemoryMB), types.BoolValue(x.SSH), types.BoolValue(x.CloudInit)})
	}
	m.Names = fromList(names)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

// ── lab_flavors ──

type flavorAPI struct {
	Name     string `json:"name"`
	MemoryMB int64  `json:"memory_mb"`
	VCPUs    int64  `json:"vcpus"`
}

type flavorModel struct {
	Name     types.String `tfsdk:"name"`
	MemoryMB types.Int64  `tfsdk:"memory_mb"`
	VCPUs    types.Int64  `tfsdk:"vcpus"`
}

type flavorsModel struct {
	MinMemoryMB types.Int64   `tfsdk:"min_memory_mb"`
	Names       types.List    `tfsdk:"names"`
	Flavors     []flavorModel `tfsdk:"flavors"`
}

type flavorsDataSource struct{ dsBase }

func (d *flavorsDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_flavors"
}

func (d *flavorsDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "VM sizes, smallest first.",
		Attributes: map[string]schema.Attribute{
			"min_memory_mb": schema.Int64Attribute{Optional: true, Description: "Only flavors with at least this much memory."},
			"names":         schema.ListAttribute{ElementType: types.StringType, Computed: true},
			"flavors": schema.ListNestedAttribute{Computed: true, NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
				"name":      schema.StringAttribute{Computed: true},
				"memory_mb": schema.Int64Attribute{Computed: true},
				"vcpus":     schema.Int64Attribute{Computed: true},
			}}},
		},
	}
}

func (d *flavorsDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var m flavorsModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &m)...)
	items, err := List[flavorAPI](ctx, d.c, "/flavors")
	if err != nil {
		addErr(&resp.Diagnostics, "list flavors", err)
		return
	}
	names := []string{}
	m.Flavors = []flavorModel{}
	for _, x := range items {
		if !m.MinMemoryMB.IsNull() && x.MemoryMB < m.MinMemoryMB.ValueInt64() {
			continue
		}
		names = append(names, x.Name)
		m.Flavors = append(m.Flavors, flavorModel{types.StringValue(x.Name), types.Int64Value(x.MemoryMB), types.Int64Value(x.VCPUs)})
	}
	m.Names = fromList(names)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

// ── lab_network and lab_subnet (look up by id or name, e.g. "default") ──

type networkDataSource struct{ dsBase }

type networkDSModel struct {
	ID     types.String `tfsdk:"id"`
	Name   types.String `tfsdk:"name"`
	CIDR   types.String `tfsdk:"cidr"`
	VLAN   types.Int64  `tfsdk:"vlan"`
	Labels types.Map    `tfsdk:"labels"`
}

func (d *networkDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_network"
}

func (d *networkDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "An existing network by name (e.g. default).",
		Attributes: map[string]schema.Attribute{
			"name":   schema.StringAttribute{Required: true},
			"id":     schema.StringAttribute{Computed: true},
			"cidr":   schema.StringAttribute{Computed: true},
			"vlan":   schema.Int64Attribute{Computed: true},
			"labels": schema.MapAttribute{ElementType: types.StringType, Computed: true},
		},
	}
}

func (d *networkDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var m networkDSModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &m)...)
	var a networkAPI
	if err := d.c.Get(ctx, d.c.P("networks", m.Name.ValueString()), &a); err != nil {
		addErr(&resp.Diagnostics, "read network "+m.Name.ValueString(), err)
		return
	}
	m.ID, m.CIDR, m.VLAN, m.Labels = types.StringValue(a.ID), types.StringValue(a.CIDR), types.Int64Value(a.VLAN), fromMap(a.Labels)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

type subnetDataSource struct{ dsBase }

type subnetDSModel struct {
	ID        types.String `tfsdk:"id"`
	Name      types.String `tfsdk:"name"`
	NetworkID types.String `tfsdk:"network_id"`
	CIDR      types.String `tfsdk:"cidr"`
	Gateway   types.String `tfsdk:"gateway"`
	Labels    types.Map    `tfsdk:"labels"`
}

func (d *subnetDataSource) Metadata(_ context.Context, req datasource.MetadataRequest, resp *datasource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_subnet"
}

func (d *subnetDataSource) Schema(_ context.Context, _ datasource.SchemaRequest, resp *datasource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "An existing subnet by name (e.g. default, 10.0.0.0/24).",
		Attributes: map[string]schema.Attribute{
			"name":       schema.StringAttribute{Required: true},
			"id":         schema.StringAttribute{Computed: true},
			"network_id": schema.StringAttribute{Computed: true},
			"cidr":       schema.StringAttribute{Computed: true},
			"gateway":    schema.StringAttribute{Computed: true},
			"labels":     schema.MapAttribute{ElementType: types.StringType, Computed: true},
		},
	}
}

func (d *subnetDataSource) Read(ctx context.Context, req datasource.ReadRequest, resp *datasource.ReadResponse) {
	var m subnetDSModel
	resp.Diagnostics.Append(req.Config.Get(ctx, &m)...)
	var a subnetAPI
	if err := d.c.Get(ctx, d.c.P("subnets", m.Name.ValueString()), &a); err != nil {
		addErr(&resp.Diagnostics, "read subnet "+m.Name.ValueString(), err)
		return
	}
	m.ID, m.NetworkID, m.CIDR, m.Gateway, m.Labels = types.StringValue(a.ID), types.StringValue(a.NetworkID), types.StringValue(a.CIDR), types.StringValue(a.Gateway), fromMap(a.Labels)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}
