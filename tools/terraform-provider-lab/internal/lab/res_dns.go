package lab

import (
	"context"
	"fmt"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64default"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// ── lab_dns_zone ──

type zoneAPI struct {
	meta
}

type zoneModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
}

func (m *zoneModel) set(a zoneAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
}

type dnsZoneResource struct{ base }

func (r *dnsZoneResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_dns_zone"
}

func (r *dnsZoneResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	n := nameAttr("zone")
	n.Description = "A domain ending in .lab, e.g. shop.lab (cloud.lab, git.lab and mirror.lab are reserved). Changing it replaces the zone."
	resp.Schema = schema.Schema{
		Description: "A DNS zone served by the lab DNS at the gateway of every subnet.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        n,
			"description": replaceOnChange(descriptionAttr()),
			"labels":      replaceMapOnChange(labelsAttr()),
		},
	}
}

func (r *dnsZoneResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m zoneModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a zoneAPI
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics)}
	if err := r.c.Create(ctx, r.c.P("dns", "zones"), body, &a); err != nil {
		addErr(&resp.Diagnostics, "create DNS zone", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *dnsZoneResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m zoneModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a zoneAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("dns", "zones", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

// Update is never planned: zones have no PATCH, every attribute replaces the zone.
func (r *dnsZoneResource) Update(_ context.Context, _ resource.UpdateRequest, resp *resource.UpdateResponse) {
	resp.Diagnostics.AddError("lab: DNS zones cannot be changed in place", "Replace the zone.")
}

func (r *dnsZoneResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m zoneModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("dns", "zones", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete DNS zone", err)
	}
}

func (r *dnsZoneResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}

// ── lab_dns_record ──

type recordAPI struct {
	meta
	ZoneID string   `json:"zone_id"`
	FQDN   string   `json:"fqdn"`
	Type   string   `json:"type"`
	Values []string `json:"values"`
	TTL    int64    `json:"ttl"`
}

type recordModel struct {
	ID          types.String `tfsdk:"id"`
	ZoneID      types.String `tfsdk:"zone_id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
	Type        types.String `tfsdk:"type"`
	Values      types.List   `tfsdk:"values"`
	TTL         types.Int64  `tfsdk:"ttl"`
	FQDN        types.String `tfsdk:"fqdn"`
}

func (m *recordModel) set(ctx context.Context, c *Client, a recordAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.ZoneID = c.keepRef(ctx, "dns/zones", m.ZoneID, a.ZoneID)
	m.Type, m.Values, m.TTL, m.FQDN = types.StringValue(a.Type), fromList(a.Values), types.Int64Value(a.TTL), types.StringValue(a.FQDN)
}

func (m *recordModel) path(c *Client) string {
	return c.P("dns", "zones", m.ZoneID.ValueString(), "records", m.ID.ValueString())
}

type dnsRecordResource struct{ base }

func (r *dnsRecordResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_dns_record"
}

func (r *dnsRecordResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	n := nameAttr("record")
	n.Description = "Name relative to the zone, \"@\" for the apex. Changing it replaces the record."
	resp.Schema = schema.Schema{
		Description: "A DNS record (A, CNAME or TXT) in a lab_dns_zone. Import with <zone>/<record>.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"zone_id":     schema.StringAttribute{Required: true, Description: "Zone id or name.", PlanModifiers: requiresReplace()},
			"name":        n,
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"type":        schema.StringAttribute{Required: true, Description: "A, CNAME or TXT.", PlanModifiers: requiresReplace()},
			"values":      schema.ListAttribute{ElementType: types.StringType, Required: true, Description: "Addresses, a target name or texts."},
			"ttl":         schema.Int64Attribute{Optional: true, Computed: true, Default: int64default.StaticInt64(60)},
			"fqdn":        schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
		},
	}
}

func (r *dnsRecordResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m recordModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	d := &resp.Diagnostics
	var a recordAPI
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, d), "type": m.Type.ValueString(), "values": toStrings(ctx, m.Values, d), "ttl": m.TTL.ValueInt64()}
	if err := r.c.Create(ctx, r.c.P("dns", "zones", m.ZoneID.ValueString(), "records"), body, &a); err != nil {
		addErr(d, "create DNS record", err)
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *dnsRecordResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m recordModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a recordAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, m.path(r.c), &a, resp) {
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *dnsRecordResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m recordModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	d := &resp.Diagnostics
	var a recordAPI
	body := map[string]any{"description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, d), "values": toStrings(ctx, m.Values, d), "ttl": m.TTL.ValueInt64()}
	if err := r.c.Patch(ctx, m.path(r.c), body, &a); err != nil {
		addErr(d, "update DNS record", err)
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *dnsRecordResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m recordModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, m.path(r.c)); err != nil {
		addErr(&resp.Diagnostics, "delete DNS record", err)
	}
}

func (r *dnsRecordResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	zone, rec, ok := strings.Cut(req.ID, "/")
	if !ok || zone == "" || rec == "" {
		resp.Diagnostics.AddError("lab: bad import id", fmt.Sprintf("expected <zone>/<record> (ids or names), got %q", req.ID))
		return
	}
	// The zone may be given by name; the state keeps its id, like lab_dns_zone.<name>.id.
	var z zoneAPI
	if err := r.c.Get(ctx, r.c.P("dns", "zones", zone), &z); err != nil {
		addErr(&resp.Diagnostics, "import DNS record: read zone "+zone, err)
		return
	}
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("zone_id"), z.ID)...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("id"), rec)...)
}
