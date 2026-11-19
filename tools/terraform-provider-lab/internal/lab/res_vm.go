package lab

import (
	"context"
	"errors"
	"fmt"

	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/int64planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/listdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/listplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/setdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/setplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// ── lab_vm ──

type vmAPI struct {
	meta
	Hostname          string   `json:"hostname"`
	Flavor            string   `json:"flavor"`
	Image             string   `json:"image"`
	MemoryMB          int64    `json:"memory_mb"`
	SubnetID          string   `json:"subnet_id"`
	NetworkID         string   `json:"network_id"`
	IP                string   `json:"ip"`
	MAC               string   `json:"mac"`
	FQDN              string   `json:"fqdn"`
	SecurityGroupIDs  []string `json:"security_group_ids"`
	SSHKeyIDs         []string `json:"ssh_key_ids"`
	SSHAuthorizedKeys []string `json:"ssh_authorized_keys"`
	DiskIDs           []string `json:"disk_ids"`
	Status            string   `json:"status"`
	StatusMessage     string   `json:"status_message"`
	Boot              *struct {
		Kind string `json:"kind"`
		MS   int64  `json:"ms"`
	} `json:"boot"`
}

type vmModel struct {
	ID                types.String `tfsdk:"id"`
	Name              types.String `tfsdk:"name"`
	Description       types.String `tfsdk:"description"`
	Labels            types.Map    `tfsdk:"labels"`
	Hostname          types.String `tfsdk:"hostname"`
	Flavor            types.String `tfsdk:"flavor"`
	Image             types.String `tfsdk:"image"`
	SubnetID          types.String `tfsdk:"subnet_id"`
	IP                types.String `tfsdk:"ip"`
	SecurityGroupIDs  types.Set    `tfsdk:"security_group_ids"`
	SSHKeyIDs         types.Set    `tfsdk:"ssh_key_ids"`
	SSHAuthorizedKeys types.List   `tfsdk:"ssh_authorized_keys"`
	UserData          types.String `tfsdk:"user_data"`
	DiskIDs           types.List   `tfsdk:"disk_ids"`
	MemoryMB          types.Int64  `tfsdk:"memory_mb"`
	NetworkID         types.String `tfsdk:"network_id"`
	MAC               types.String `tfsdk:"mac"`
	FQDN              types.String `tfsdk:"fqdn"`
	Status            types.String `tfsdk:"status"`
	BootMS            types.Int64  `tfsdk:"boot_ms"`
}

func (m *vmModel) set(ctx context.Context, c *Client, a vmAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.Hostname, m.Flavor, m.Image = types.StringValue(a.Hostname), types.StringValue(a.Flavor), types.StringValue(a.Image)
	m.SubnetID = c.keepRef(ctx, "subnets", m.SubnetID, a.SubnetID)
	m.IP, m.MemoryMB, m.NetworkID, m.MAC, m.FQDN = types.StringValue(a.IP), types.Int64Value(a.MemoryMB), types.StringValue(a.NetworkID), types.StringValue(a.MAC), types.StringValue(a.FQDN)
	m.SecurityGroupIDs = c.keepRefSet(ctx, "security-groups", m.SecurityGroupIDs, a.SecurityGroupIDs)
	m.SSHKeyIDs = c.keepRefSet(ctx, "ssh-keys", m.SSHKeyIDs, a.SSHKeyIDs)
	m.SSHAuthorizedKeys = fromList(a.SSHAuthorizedKeys)
	m.DiskIDs = keepRefList(ctx, c, "disks", m.DiskIDs, a.DiskIDs)
	m.Status = types.StringValue(a.Status)
	if a.Boot != nil {
		m.BootMS = types.Int64Value(a.Boot.MS)
	} else if m.BootMS.IsUnknown() {
		m.BootMS = types.Int64Null()
	}
	if m.UserData.IsUnknown() {
		m.UserData = types.StringNull()
	}
}

func keepRefList(ctx context.Context, c *Client, collection string, prior types.List, ids []string) types.List {
	var refs []string
	if prior.IsNull() || prior.IsUnknown() || prior.ElementsAs(ctx, &refs, false).HasError() || len(refs) != len(ids) {
		return fromList(ids)
	}
	for i := range refs {
		if !c.sameRef(ctx, collection, refs[i], ids[i]) {
			return fromList(ids)
		}
	}
	return prior
}

type vmResource struct{ base }

func (r *vmResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_vm"
}

var emptyStrings = []attr.Value{}

func (r *vmResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	replaceKeep := []planmodifier.String{stringplanmodifier.RequiresReplace(), stringplanmodifier.UseStateForUnknown()}
	resp.Schema = schema.Schema{
		Description: "A virtual machine: a real Linux machine emulated by v86 in the browser tab, plugged into the lab switch. Creating it boots the machine; the apply waits until the guest is up.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("VM"),
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"hostname":    schema.StringAttribute{Optional: true, Computed: true, Description: "Default: name.", PlanModifiers: replaceKeep},
			"flavor":      schema.StringAttribute{Required: true, Description: "Size, see data source lab_flavors (lab.small = 128 MiB).", PlanModifiers: requiresReplace()},
			"image":       schema.StringAttribute{Required: true, Description: "Image name, see data source lab_images.", PlanModifiers: requiresReplace()},
			"subnet_id":   schema.StringAttribute{Optional: true, Computed: true, Description: "Subnet id or name. Default: the default subnet 10.0.0.0/24.", PlanModifiers: replaceKeep},
			"ip":          schema.StringAttribute{Optional: true, Computed: true, Description: "Fixed address in the subnet. Default: the next free one.", PlanModifiers: replaceKeep},
			"security_group_ids": schema.SetAttribute{ElementType: types.StringType, Optional: true, Computed: true,
				Description:   "Security groups (ids or names). Default: the group default. Can change on a running VM.",
				PlanModifiers: []planmodifier.Set{setplanmodifier.UseStateForUnknown()}},
			"ssh_key_ids": schema.SetAttribute{ElementType: types.StringType, Optional: true, Computed: true,
				Default:       setdefault.StaticValue(types.SetValueMust(types.StringType, emptyStrings)),
				Description:   "lab_ssh_key ids or names installed for root on first boot.",
				PlanModifiers: []planmodifier.Set{setplanmodifier.RequiresReplace()}},
			"ssh_authorized_keys": schema.ListAttribute{ElementType: types.StringType, Optional: true, Computed: true,
				Default:       listdefault.StaticValue(types.ListValueMust(types.StringType, emptyStrings)),
				Description:   "OpenSSH public keys given inline.",
				PlanModifiers: []planmodifier.List{listplanmodifier.RequiresReplace()}},
			"user_data": schema.StringAttribute{Optional: true, Description: "Shell script (#!) or #cloud-config run on first boot, at most 16 KiB.", PlanModifiers: requiresReplace()},
			"disk_ids": schema.ListAttribute{ElementType: types.StringType, Optional: true, Computed: true,
				Default:       listdefault.StaticValue(types.ListValueMust(types.StringType, emptyStrings)),
				Description:   "lab_disk ids attached before the first boot, in order (/dev/sdb, /dev/sdc, ...).",
				PlanModifiers: []planmodifier.List{listplanmodifier.RequiresReplace()}},
			"memory_mb":  schema.Int64Attribute{Computed: true, PlanModifiers: []planmodifier.Int64{int64planmodifier.UseStateForUnknown()}},
			"network_id": schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
			"mac":        schema.StringAttribute{Computed: true, PlanModifiers: keepState()},
			"fqdn":       schema.StringAttribute{Computed: true, Description: "<name>.vm.lab", PlanModifiers: keepState()},
			"status":     schema.StringAttribute{Computed: true, Description: "RUNNING, STOPPED, ERROR, ..."},
			"boot_ms":    schema.Int64Attribute{Computed: true, Description: "How long the last boot took, ms.", PlanModifiers: []planmodifier.Int64{int64planmodifier.UseStateForUnknown()}},
		},
	}
}

func (r *vmResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m vmModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	d := &resp.Diagnostics
	body := map[string]any{
		"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, d),
		"flavor": m.Flavor.ValueString(), "image": m.Image.ValueString(),
		"ssh_key_ids": toStrings(ctx, m.SSHKeyIDs, d), "ssh_authorized_keys": toStrings(ctx, m.SSHAuthorizedKeys, d),
		"disk_ids": toStrings(ctx, m.DiskIDs, d),
	}
	for k, v := range map[string]types.String{"hostname": m.Hostname, "subnet_id": m.SubnetID, "ip": m.IP, "user_data": m.UserData} {
		if !v.IsNull() && !v.IsUnknown() {
			body[k] = v.ValueString()
		}
	}
	if !m.SecurityGroupIDs.IsNull() && !m.SecurityGroupIDs.IsUnknown() {
		body["security_group_ids"] = toStrings(ctx, m.SecurityGroupIDs, d)
	}
	var a vmAPI
	err := r.c.Create(ctx, r.c.P("vms"), body, &a)
	if a.ID != "" {
		// Saved even when the boot failed: the VM exists and the next apply replaces it (tainted).
		m.set(ctx, r.c, a)
		resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
	}
	if err != nil {
		var oe *OpError
		if errors.As(err, &oe) && a.StatusMessage != "" {
			err = fmt.Errorf("%w\n\nVM status: %s %s. GET %s shows the serial console.", err, a.Status, a.StatusMessage, r.c.Endpoint+r.c.P("vms", a.ID, "console"))
		}
		addErr(d, "create VM "+m.Name.ValueString(), err)
	}
}

func (r *vmResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m vmModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a vmAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("vms", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *vmResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m vmModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	body := map[string]any{"description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics)}
	if !m.SecurityGroupIDs.IsNull() && !m.SecurityGroupIDs.IsUnknown() {
		body["security_group_ids"] = toStrings(ctx, m.SecurityGroupIDs, &resp.Diagnostics)
	}
	var a vmAPI
	if err := r.c.Patch(ctx, r.c.P("vms", m.ID.ValueString()), body, &a); err != nil {
		addErr(&resp.Diagnostics, "update VM", err)
		return
	}
	m.set(ctx, r.c, a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *vmResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m vmModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("vms", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete VM", err)
	}
}

func (r *vmResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}

// ── lab_disk ──

type diskAPI struct {
	meta
	SizeMB int64   `json:"size_mb"`
	Status string  `json:"status"`
	VMID   *string `json:"vm_id"`
	Device *string `json:"device"`
}

type diskModel struct {
	ID          types.String `tfsdk:"id"`
	Name        types.String `tfsdk:"name"`
	Description types.String `tfsdk:"description"`
	Labels      types.Map    `tfsdk:"labels"`
	SizeMB      types.Int64  `tfsdk:"size_mb"`
	Status      types.String `tfsdk:"status"`
	VMID        types.String `tfsdk:"vm_id"`
	Device      types.String `tfsdk:"device"`
}

func (m *diskModel) set(a diskAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.SizeMB, m.Status = types.Int64Value(a.SizeMB), types.StringValue(a.Status)
	m.VMID, m.Device = types.StringPointerValue(a.VMID), types.StringPointerValue(a.Device)
}

type diskResource struct{ base }

func (r *diskResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_disk"
}

func (r *diskResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "A blank virtual disk. Give it to a VM with disk_ids; inside the guest it is /dev/sdb, /dev/sdc, ...",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        nameAttr("disk"),
			"description": descriptionAttr(),
			"labels":      labelsAttr(),
			"size_mb": schema.Int64Attribute{Required: true, Description: "8 to 1024 MiB (the disk lives in the tab's memory).",
				PlanModifiers: []planmodifier.Int64{int64planmodifier.RequiresReplace()}},
			"status": schema.StringAttribute{Computed: true, Description: "AVAILABLE or IN_USE."},
			"vm_id":  schema.StringAttribute{Computed: true, Description: "The VM it is attached to."},
			"device": schema.StringAttribute{Computed: true, Description: "Its name inside that VM."},
		},
	}
}

func (r *diskResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m diskModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a diskAPI
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics), "size_mb": m.SizeMB.ValueInt64()}
	err := r.c.Create(ctx, r.c.P("disks"), body, &a)
	if a.ID != "" {
		m.set(a)
		resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
	}
	if err != nil {
		addErr(&resp.Diagnostics, "create disk", err)
	}
}

func (r *diskResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m diskModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a diskAPI
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("disks", m.ID.ValueString()), &a, resp) {
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *diskResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m diskModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a diskAPI
	body := map[string]any{"description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics)}
	if err := r.c.Patch(ctx, r.c.P("disks", m.ID.ValueString()), body, &a); err != nil {
		addErr(&resp.Diagnostics, "update disk", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *diskResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m diskModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if err := r.c.Delete(ctx, r.c.P("disks", m.ID.ValueString())); err != nil {
		addErr(&resp.Diagnostics, "delete disk", err)
	}
}

func (r *diskResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	importID(ctx, req, resp)
}
