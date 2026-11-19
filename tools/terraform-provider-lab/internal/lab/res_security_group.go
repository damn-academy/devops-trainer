package lab

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/listdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

type ruleAPI struct {
	Direction   string `json:"direction"`
	Protocol    string `json:"protocol"`
	PortMin     *int64 `json:"port_min,omitempty"`
	PortMax     *int64 `json:"port_max,omitempty"`
	CIDR        string `json:"cidr"`
	Description string `json:"description,omitempty"`
}

type sgAPI struct {
	meta
	Rules []ruleAPI `json:"rules"`
}

type ruleModel struct {
	Direction   types.String `tfsdk:"direction"`
	Protocol    types.String `tfsdk:"protocol"`
	PortMin     types.Int64  `tfsdk:"port_min"`
	PortMax     types.Int64  `tfsdk:"port_max"`
	CIDR        types.String `tfsdk:"cidr"`
	Description types.String `tfsdk:"description"`
}

var ruleType = types.ObjectType{AttrTypes: map[string]attr.Type{
	"direction": types.StringType, "protocol": types.StringType, "port_min": types.Int64Type,
	"port_max": types.Int64Type, "cidr": types.StringType, "description": types.StringType,
}}

type sgModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
	Rules       []ruleModel  `tfsdk:"rules"`
}

func (m *sgModel) set(a sgAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.Rules = make([]ruleModel, len(a.Rules))
	for i, r := range a.Rules {
		m.Rules[i] = ruleModel{
			Direction: types.StringValue(r.Direction), Protocol: types.StringValue(r.Protocol),
			PortMin: types.Int64PointerValue(r.PortMin), PortMax: types.Int64PointerValue(r.PortMax),
			CIDR: types.StringValue(r.CIDR), Description: types.StringValue(r.Description),
		}
	}
}

func (m *sgModel) rules() []ruleAPI {
	out := make([]ruleAPI, len(m.Rules))
	for i, r := range m.Rules {
		out[i] = ruleAPI{Direction: r.Direction.ValueString(), Protocol: r.Protocol.ValueString(), PortMin: r.PortMin.ValueInt64Pointer(), PortMax: r.PortMax.ValueInt64Pointer(), CIDR: r.CIDR.ValueString(), Description: r.Description.ValueString()}
	}
	return out
}

type securityGroupResource struct{ base }

func (r *securityGroupResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_security_group"
}

func (r *securityGroupResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "Firewall rules. The lab host enforces them on traffic it carries (load balancers, routing between subnets); images with iptables apply them on boot.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("security group"),
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"rules": schema.ListNestedAttribute{
				Optional: true, Computed: true,
				Default:     listdefault.StaticValue(types.ListValueMust(ruleType, []attr.Value{})),
				Description: "Rules in order. Changing them updates running VMs.",
				NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
					"direction":   schema.StringAttribute{Required: true, Description: "ingress or egress."},
					"protocol":    schema.StringAttribute{Required: true, Description: "tcp, udp, icmp or all."},
					"port_min":    schema.Int64Attribute{Optional: true, Description: "First port (tcp and udp)."},
					"port_max":    schema.Int64Attribute{Optional: true, Description: "Last port (tcp and udp)."},
					"cidr":        schema.StringAttribute{Optional: true, Computed: true, Default: stringdefault.StaticString("0.0.0.0/0"), Description: "Peer addresses, in canonical form (10.0.0.0/24)."},
					"description": schema.StringAttribute{Optional: true, Computed: true, Default: stringdefault.StaticString("")},
				}},
			},
		},
	}
}

func (r *securityGroupResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m sgModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a sgAPI
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics), "rules": m.rules()}
	if err := r.c.Create(ctx, r.c.P("security-groups"), body, &a); err != nil {
		addErr(&resp.Diagnostics, "create security group", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *securityGroupResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m sgModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a sgAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("security-groups", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *securityGroupResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m sgModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a sgAPI
	body := map[string]any{"description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics), "rules": m.rules()}
	if err := r.c.Patch(ctx, r.c.P("security-groups", m.ID.ValueString()), body, &a); err != nil {
		addErr(&resp.Diagnostics, "update security group", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *securityGroupResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m sgModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("security-groups", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete security group", err)
	}
}

func (r *securityGroupResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}
