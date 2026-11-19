package lab

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/path"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/booldefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/boolplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

// ── lab_bucket ──

type bucketAPI struct {
	meta
	Endpoint   string `json:"endpoint"`
	Versioning bool   `json:"versioning"`
}

type bucketModel struct {
	ID           types.String `tfsdk:"id"`
	Name         types.String `tfsdk:"name"`
	Description  types.String `tfsdk:"description"`
	Labels       types.Map    `tfsdk:"labels"`
	Versioning   types.Bool   `tfsdk:"versioning"`
	ForceDestroy types.Bool   `tfsdk:"force_destroy"`
	Endpoint     types.String `tfsdk:"endpoint"`
}

func (m *bucketModel) set(a bucketAPI) {
	m.ID, m.Name, m.Description, m.Labels = types.StringValue(a.ID), types.StringValue(a.Name), types.StringValue(a.Description), fromMap(a.Labels)
	m.Versioning, m.Endpoint = types.BoolValue(a.Versioning), types.StringValue(a.Endpoint)
	if m.ForceDestroy.IsNull() || m.ForceDestroy.IsUnknown() {
		m.ForceDestroy = types.BoolValue(false)
	}
}

type bucketResource struct{ base }

func (r *bucketResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_bucket"
}

func (r *bucketResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	n := nameAttr("bucket")
	n.Description = "Bucket name, global in the tab: ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$. Changing it replaces the bucket."
	resp.Schema = schema.Schema{
		Description: "A bucket of the S3-compatible object storage (s3.cloud.lab). Enough for the s3 backend of Terraform/OpenTofu.",
		Attributes: map[string]schema.Attribute{
			"id":          idAttr(),
			"name":        n,
			"description": replaceOnChange(descriptionAttr()),
			"labels":      replaceMapOnChange(labelsAttr()),
			"versioning": schema.BoolAttribute{Optional: true, Computed: true, Default: booldefault.StaticBool(false),
				PlanModifiers: []planmodifier.Bool{boolplanmodifier.RequiresReplace()}},
			"force_destroy": schema.BoolAttribute{Optional: true, Computed: true, Default: booldefault.StaticBool(false),
				Description: "Delete the objects too when the bucket is destroyed."},
			"endpoint": schema.StringAttribute{Computed: true, Description: "http://s3.cloud.lab/<name>", PlanModifiers: keepState()},
		},
	}
}

func (r *bucketResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m bucketModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	var a bucketAPI
	body := map[string]any{"name": m.Name.ValueString(), "description": m.Description.ValueString(), "labels": toMap(ctx, m.Labels, &resp.Diagnostics), "versioning": m.Versioning.ValueBool()}
	if err := r.c.Create(ctx, r.c.P("buckets"), body, &a); err != nil {
		addErr(&resp.Diagnostics, "create bucket", err)
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *bucketResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m bucketModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	var a bucketAPI
	// Buckets are addressed by name.
	ref := m.Name.ValueString()
	if ref == "" {
		ref = m.ID.ValueString()
	}
	if resp.Diagnostics.HasError() || !readInto(ctx, r.c, r.c.P("buckets", ref), &a, resp) {
		return
	}
	m.set(a)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

// Update only changes force_destroy, which lives in the state.
func (r *bucketResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m bucketModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *bucketResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m bucketModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	p := r.c.P("buckets", m.Name.ValueString())
	if m.ForceDestroy.ValueBool() {
		p += "?force=true"
	}
	if err := r.c.Delete(ctx, p); err != nil {
		addErr(&resp.Diagnostics, "delete bucket", err)
	}
}

func (r *bucketResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("name"), req.ID)...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("id"), req.ID)...)
}

// ── lab_object ──

type objectModel struct {
	ID          types.String `tfsdk:"id"`
	Bucket      types.String `tfsdk:"bucket"`
	Key         types.String `tfsdk:"key"`
	Content     types.String `tfsdk:"content"`
	Source      types.String `tfsdk:"source"`
	ContentType types.String `tfsdk:"content_type"`
	ETag        types.String `tfsdk:"etag"`
	Size        types.Int64  `tfsdk:"size"`
}

type objectResource struct{ base }

var _ resource.ResourceWithModifyPlan = &objectResource{}

func (r *objectResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
	resp.TypeName = req.ProviderTypeName + "_object"
}

func (r *objectResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
	resp.Schema = schema.Schema{
		Description: "An object in a lab_bucket. A change of the object outside Terraform (another ETag) shows as an update in the next plan. Import with <bucket>/<key>.",
		Attributes: map[string]schema.Attribute{
			"id":           schema.StringAttribute{Computed: true, Description: "<bucket>/<key>", PlanModifiers: keepState()},
			"bucket":       schema.StringAttribute{Required: true, PlanModifiers: requiresReplace()},
			"key":          schema.StringAttribute{Required: true, PlanModifiers: requiresReplace()},
			"content":      schema.StringAttribute{Optional: true, Description: "Text content. Exactly one of content and source."},
			"source":       schema.StringAttribute{Optional: true, Description: "Path of a local file to upload."},
			"content_type": schema.StringAttribute{Optional: true, Computed: true, PlanModifiers: keepState()},
			"etag":         schema.StringAttribute{Computed: true, Description: "MD5 of the content, hex."},
			"size":         schema.Int64Attribute{Computed: true},
		},
	}
}

func (m *objectModel) data() ([]byte, error) {
	hasContent := !m.Content.IsNull() && !m.Content.IsUnknown()
	hasSource := !m.Source.IsNull() && !m.Source.IsUnknown()
	switch {
	case hasContent && hasSource:
		return nil, fmt.Errorf("set only one of content and source")
	case hasContent:
		return []byte(m.Content.ValueString()), nil
	case hasSource:
		return os.ReadFile(m.Source.ValueString())
	}
	if m.Content.IsUnknown() || m.Source.IsUnknown() {
		return nil, nil
	}
	return nil, fmt.Errorf("set content or source")
}

// ModifyPlan plans the ETag of the new bytes; when it differs from the state
// (the configuration changed, or the object was changed outside), it is an update.
func (r *objectResource) ModifyPlan(ctx context.Context, req resource.ModifyPlanRequest, resp *resource.ModifyPlanResponse) {
	if req.Plan.Raw.IsNull() {
		return
	}
	var plan objectModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &plan)...)
	if resp.Diagnostics.HasError() {
		return
	}
	b, err := plan.data()
	if err != nil {
		resp.Diagnostics.AddError("lab: object content", err.Error())
		return
	}
	if b == nil {
		return
	}
	plan.ETag, plan.Size = types.StringValue(ETagOf(b)), types.Int64Value(int64(len(b)))
	if plan.ID.IsUnknown() {
		plan.ID = types.StringValue(plan.Bucket.ValueString() + "/" + plan.Key.ValueString())
	}
	resp.Diagnostics.Append(resp.Plan.Set(ctx, &plan)...)
}

func (r *objectResource) put(ctx context.Context, m *objectModel) error {
	b, err := m.data()
	if err != nil {
		return err
	}
	ct := m.ContentType.ValueString()
	if m.ContentType.IsUnknown() || ct == "" {
		ct = http.DetectContentType(b)
		if !m.Content.IsNull() && strings.HasPrefix(ct, "text/plain") {
			ct = "text/plain; charset=utf-8"
		}
	}
	res, _, err := r.c.S3(ctx, http.MethodPut, m.Bucket.ValueString(), m.Key.ValueString(), b, ct)
	if err != nil {
		return err
	}
	m.ID = types.StringValue(m.Bucket.ValueString() + "/" + m.Key.ValueString())
	m.ContentType = types.StringValue(ct)
	m.ETag = types.StringValue(strings.Trim(res.Header.Get("ETag"), `"`))
	if m.ETag.ValueString() == "" {
		m.ETag = types.StringValue(ETagOf(b))
	}
	m.Size = types.Int64Value(int64(len(b)))
	return nil
}

func (r *objectResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
	var m objectModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if err := r.put(ctx, &m); err != nil {
		addErr(&resp.Diagnostics, "upload object", err)
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *objectResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
	var m objectModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	res, _, err := r.c.S3(ctx, http.MethodHead, m.Bucket.ValueString(), m.Key.ValueString(), nil, "")
	if IsNotFound(err) {
		resp.State.RemoveResource(ctx)
		return
	}
	if err != nil {
		addErr(&resp.Diagnostics, "read object", err)
		return
	}
	m.ID = types.StringValue(m.Bucket.ValueString() + "/" + m.Key.ValueString())
	m.ETag = types.StringValue(strings.Trim(res.Header.Get("ETag"), `"`))
	// The ETag decides drift; a HEAD without Content-Length keeps the known size.
	if res.ContentLength >= 0 {
		m.Size = types.Int64Value(res.ContentLength)
	}
	if ct := res.Header.Get("Content-Type"); ct != "" {
		m.ContentType = types.StringValue(ct)
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *objectResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
	var m objectModel
	resp.Diagnostics.Append(req.Plan.Get(ctx, &m)...)
	if resp.Diagnostics.HasError() {
		return
	}
	if err := r.put(ctx, &m); err != nil {
		addErr(&resp.Diagnostics, "upload object", err)
		return
	}
	resp.Diagnostics.Append(resp.State.Set(ctx, &m)...)
}

func (r *objectResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
	var m objectModel
	resp.Diagnostics.Append(req.State.Get(ctx, &m)...)
	if _, _, err := r.c.S3(ctx, http.MethodDelete, m.Bucket.ValueString(), m.Key.ValueString(), nil, ""); err != nil && !IsNotFound(err) {
		addErr(&resp.Diagnostics, "delete object", err)
	}
}

func (r *objectResource) ImportState(ctx context.Context, req resource.ImportStateRequest, resp *resource.ImportStateResponse) {
	bucket, key, ok := strings.Cut(req.ID, "/")
	if !ok || bucket == "" || key == "" {
		resp.Diagnostics.AddError("lab: bad import id", fmt.Sprintf("expected <bucket>/<key>, got %q", req.ID))
		return
	}
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("bucket"), bucket)...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("key"), key)...)
	resp.Diagnostics.Append(resp.State.SetAttribute(ctx, path.Root("id"), req.ID)...)
}
