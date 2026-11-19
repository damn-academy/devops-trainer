package lab

import (
	"context"

	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/types/basetypes"

	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/objectplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/setdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

type listenerAPI struct {
	Protocol   string `json:"protocol"`
	Port       int64  `json:"port"`
	TargetPort int64  `json:"target_port"`
}

type healthAPI struct {
	Path               string `json:"path,omitempty"`
	Port               *int64 `json:"port,omitempty"`
	IntervalS          int64  `json:"interval_s,omitempty"`
	HealthyThreshold   int64  `json:"healthy_threshold,omitempty"`
	UnhealthyThreshold int64  `json:"unhealthy_threshold,omitempty"`
}

type lbAPI struct {
	meta
	SubnetID    string        `json:"subnet_id"`
	VIP         string        `json:"vip"`
	FQDN        string        `json:"fqdn"`
	Listeners   []listenerAPI `json:"listeners"`
	TargetVMIDs []string      `json:"target_vm_ids"`
	Algorithm   string        `json:"algorithm"`
	HealthCheck healthAPI     `json:"health_check"`
	Status      string        `json:"status"`
}

type listenerModel struct {
	Protocol   types.String `tfsdk:"protocol"`
	Port       types.Int64  `tfsdk:"port"`
	TargetPort types.Int64  `tfsdk:"target_port"`
}

type healthModel struct {
	Path               types.String `tfsdk:"path"`
	Port               types.Int64  `tfsdk:"port"`
	IntervalS          types.Int64  `tfsdk:"interval_s"`
	HealthyThreshold   types.Int64  `tfsdk:"healthy_threshold"`
	UnhealthyThreshold types.Int64  `tfsdk:"unhealthy_threshold"`
}

type lbModel struct {
	ID          types.String    `tfsdk:"id"`
	Name        types.String    `tfsdk:"name"`
	Description types.String    `tfsdk:"description"`
	Labels      types.Map       `tfsdk:"labels"`
	SubnetID    types.String    `tfsdk:"subnet_id"`
	Listeners   []listenerModel `tfsdk:"listeners"`
	TargetVMIDs types.Set       `tfsdk:"target_vm_ids"`
	Algorithm   types.String    `tfsdk:"algorithm"`
	HealthCheck types.Object    `tfsdk:"health_check"`
	VIP         types.String    `tfsdk:"vip"`
	FQDN        types.String    `tfsdk:"fqdn"`
	Status      types.String    `tfsdk:"status"`
}

func (m *lbModel) set(ctx context.Context, c *Client, a lbAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.SubnetID = c.keepRef(ctx, "subnets", m.SubnetID, a.SubnetID)
	m.Listeners = make([]listenerModel, len(a.Listeners))
	for i, l := range a.Listeners {
		m.Listeners[i] = listenerModel{Protocol: types.StringValue(l.Protocol), Port: types.Int64Value(l.Port), TargetPort: types.Int64Value(l.TargetPort)}
	}
	m.TargetVMIDs = c.keepRefSet(ctx, "vms", m.TargetVMIDs, a.TargetVMIDs)
	m.Algorithm = types.StringValue(a.Algorithm)
	h := a.HealthCheck
	m.HealthCheck = types.ObjectValueMust(healthType.AttrTypes, map[string]attr.Value{
		"path": types.StringValue(h.Path), "port": types.Int64PointerValue(h.Port), "interval_s": types.Int64Value(h.IntervalS),
		"healthy_threshold": types.Int64Value(h.HealthyThreshold), "unhealthy_threshold": types.Int64Value(h.UnhealthyThreshold),
	})
	m.VIP, m.FQDN, m.Status = types.StringValue(a.VIP), types.StringValue(a.FQDN), types.StringValue(a.Status)
}

var healthType = types.ObjectType{AttrTypes: map[string]attr.Type{
	"path": types.StringType, "port": types.Int64Type, "interval_s": types.Int64Type, "healthy_threshold": types.Int64Type, "unhealthy_threshold": types.Int64Type,
}}

func (m *lbModel) body(ctx context.Context, d *diag.Diagnostics) map[string]any {
	ls := make([]map[string]any, len(m.Listeners))
	for i, l := range m.Listeners {
		x := map[string]any{"port": l.Port.ValueInt64(), "protocol": "http"}
		if !l.TargetPort.IsNull() && !l.TargetPort.IsUnknown() {
			x["target_port"] = l.TargetPort.ValueInt64()
		}
		ls[i] = x
	}
	b := map[string]any{"listeners": ls, "algorithm": m.Algorithm.ValueString()}
	if !m.HealthCheck.IsNull() && !m.HealthCheck.IsUnknown() {
		var h healthModel
		d.Append(m.HealthCheck.As(ctx, &h, basetypes.ObjectAsOptions{UnhandledUnknownAsEmpty: true})...)
		hc := map[string]any{}
		if !h.Path.IsNull() && !h.Path.IsUnknown() {
			hc["path"] = h.Path.ValueString()
		}
		for k, v := range map[string]types.Int64{"port": h.Port, "interval_s": h.IntervalS, "healthy_threshold": h.HealthyThreshold, "unhealthy_threshold": h.UnhealthyThreshold} {
			if !v.IsNull() && !v.IsUnknown() {
				hc[k] = v.ValueInt64()
			}
		}
		b["health_check"] = hc
	}
	return b
}

type lbResource struct{ base }

func (r *lbResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_lb"
}

func optInt(desc string) schema.Int64Attribute {
	return schema.Int64Attribute{Optional: true, Computed: true, Description: desc, PlanModifiers: []planmodifier.Int64{int64planmodifier.UseStateForUnknown()}}
}

func (r *lbResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "An HTTP load balancer: the lab host owns its virtual address and proxies to healthy target VMs.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("load balancer"),
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"subnet_id": schema.StringAttribute{Optional: true, Computed: true, Description: "Default: the default subnet.",
				PlanModifiers: []planmodifier.String{stringplanmodifier.RequiresReplace(), stringplanmodifier.UseStateForUnknown()}},
			"listeners": schema.ListNestedAttribute{
				Required: true, Description: "Ports the virtual address listens on.",
				NestedObject: schema.NestedAttributeObject{Attributes: map[string]schema.Attribute{
					"protocol":    schema.StringAttribute{Optional: true, Computed: true, Default: stringdefault.StaticString("http"), Description: "http."},
					"port":        schema.Int64Attribute{Required: true},
					"target_port": optInt("Port on the targets. Default: port."),
				}},
			},
			"target_vm_ids": schema.SetAttribute{ElementType: types.StringType, Optional: true, Computed: true,
				Default:     setdefault.StaticValue(types.SetValueMust(types.StringType, emptyStrings)),
				Description: "VMs (ids or names) in the same network."},
			"algorithm": schema.StringAttribute{Optional: true, Computed: true, Default: stringdefault.StaticString("round_robin"), Description: "round_robin or least_connections."},
			"health_check": schema.SingleNestedAttribute{
				Optional: true, Computed: true, Description: "HTTP health check of the targets.",
				PlanModifiers: []planmodifier.Object{objectplanmodifier.UseStateForUnknown()},
				Attributes: map[string]schema.Attribute{
					"path":                schema.StringAttribute{Optional: true, Computed: true, Description: "Default: /.", PlanModifiers: keepState()},
					"port":                optInt("Default: the target port of the first listener."),
					"interval_s":          optInt("Default: 5."),
					"healthy_threshold":   optInt("Default: 2."),
					"unhealthy_threshold": optInt("Default: 2."),
				},
			},
			"vip":    schema.StringAttribute{Computed: true, Description: "Virtual address.", PlanModifiers: keepState()},
			"fqdn":   schema.StringAttribute{Computed: true, Description: "<name>.lb.lab", PlanModifiers: keepState()},
			"status": schema.StringAttribute{Computed: true},
		},
	}
}

func (r *lbResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m lbModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	d := &resp.Diagnostics
	b := m.body(ctx, d)
	b["name"], b["description"], b["labels"], b["target_vm_ids"] = m.Name.ValueString(), m.Description.ValueString(), toMap(ctx, m.Labels, d), toStrings(ctx, m.TargetVMIDs, d)
	if !m.SubnetID.IsNull() && !m.SubnetID.IsUnknown() {
		b["subnet_id"] = m.SubnetID.ValueString()
	}
	var a lbAPI
	err := r.c.Create(ctx, r.c.P("load-balancers"), b, &a)
	if a.ID != "" {
		m.set(ctx, r.c, a)
		resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
	}
	if err != nil {
		addErr(d, "create load balancer", err)
	}
}

func (r *lbResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m lbModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a lbAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("load-balancers", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *lbResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m lbModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	d := &resp.Diagnostics
	b := m.body(ctx, d)
	b["description"], b["labels"], b["target_vm_ids"] = m.Description.ValueString(), toMap(ctx, m.Labels, d), toStrings(ctx, m.TargetVMIDs, d)
	var a lbAPI
	if err := r.c.Patch(ctx, r.c.P("load-balancers", m.ID.ValueString()), b, &a); err != nil {
		addErr(d, "update load balancer", err)
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *lbResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m lbModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("load-balancers", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete load balancer", err)
	}
}

func (r *lbResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}
