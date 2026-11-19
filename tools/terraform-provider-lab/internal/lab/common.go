package lab

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/hashicorp/terraform-plugin-framework/attr"
	"github.com/hashicorp/terraform-plugin-framework/diag"
	"github.com/hashicorp/terraform-plugin-framework/resource"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/mapdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/mapplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringdefault"
	"github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
	"github.com/hashicorp/terraform-plugin-framework/types"
)

func b64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

// meta is the part every API resource shares.
type meta struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Project     string            `json:"project"`
	Description string            `json:"description"`
	Labels      map[string]string `json:"labels"`
	CreatedAt   string            `json:"created_at"`
}

// base gives every resource and data source the configured client.
type base struct{ c *Client }

func (b *base) configure(data any, d *diag.Diagnostics) {
	if data == nil {
		return
	}
	c, ok := data.(*Client)
	if !ok {
		d.AddError("Unexpected provider data", fmt.Sprintf("expected *lab.Client, got %T", data))
		return
	}
	b.c = c
}

func (b *base) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
	b.configure(req.ProviderData, &resp.Diagnostics)
}

// Schema pieces shared by all resources.

func idAttr() schema.StringAttribute {
	return schema.StringAttribute{
		Computed:      true,
		Description:   "Id assigned by the cloud.",
		PlanModifiers: []planmodifier.String{stringplanmodifier.UseStateForUnknown()},
	}
}

func nameAttr(what string) schema.StringAttribute {
	return schema.StringAttribute{
		Required:      true,
		Description:   "Name of the " + what + ", unique in the project: ^[a-z][a-z0-9-]{0,62}$. Changing it replaces the " + what + ".",
		PlanModifiers: []planmodifier.String{stringplanmodifier.RequiresReplace()},
	}
}

func descriptionAttr() schema.StringAttribute {
	return schema.StringAttribute{Optional: true, Computed: true, Default: stringdefault.StaticString(""), Description: "Free text."}
}

func labelsAttr() schema.MapAttribute {
	return schema.MapAttribute{
		ElementType: types.StringType,
		Optional:    true,
		Computed:    true,
		Default:     mapdefault.StaticValue(types.MapValueMust(types.StringType, map[string]attr.Value{})),
		Description: "Labels (string to string), e.g. trainer = \"devops\".",
	}
}

func replaceOnChange(a schema.StringAttribute) schema.StringAttribute {
	a.PlanModifiers = append(a.PlanModifiers, stringplanmodifier.RequiresReplace())
	return a
}

func replaceMapOnChange(a schema.MapAttribute) schema.MapAttribute {
	a.PlanModifiers = append(a.PlanModifiers, mapplanmodifier.RequiresReplace())
	return a
}

func requiresReplace() []planmodifier.String {
	return []planmodifier.String{stringplanmodifier.RequiresReplace()}
}

func keepState() []planmodifier.String {
	return []planmodifier.String{stringplanmodifier.UseStateForUnknown()}
}

// Conversions between framework values and Go values.

func toMap(ctx context.Context, v types.Map, d *diag.Diagnostics) map[string]string {
	out := map[string]string{}
	if v.IsNull() || v.IsUnknown() {
		return out
	}
	d.Append(v.ElementsAs(ctx, &out, false)...)
	return out
}

func fromMap(m map[string]string) types.Map {
	vals := map[string]attr.Value{}
	for k, v := range m {
		vals[k] = types.StringValue(v)
	}
	return types.MapValueMust(types.StringType, vals)
}

func toStrings(ctx context.Context, v interface {
	IsNull() bool
	IsUnknown() bool
	ElementsAs(context.Context, any, bool) diag.Diagnostics
}, d *diag.Diagnostics) []string {
	out := []string{}
	if v.IsNull() || v.IsUnknown() {
		return out
	}
	d.Append(v.ElementsAs(ctx, &out, false)...)
	return out
}

func fromList(s []string) types.List {
	vals := make([]attr.Value, len(s))
	for i, x := range s {
		vals[i] = types.StringValue(x)
	}
	return types.ListValueMust(types.StringType, vals)
}

func fromSet(s []string) types.Set {
	vals := make([]attr.Value, len(s))
	for i, x := range s {
		vals[i] = types.StringValue(x)
	}
	return types.SetValueMust(types.StringType, vals)
}

// The API accepts a name wherever it takes an id and answers with ids. To keep
// `subnet_id = "default"` from showing a diff on every plan, a reference the
// configuration wrote as a name stays as written while it still points at the
// same object.

func (c *Client) sameRef(ctx context.Context, collection, ref, id string) bool {
	if ref == id {
		return true
	}
	if ref == "" {
		return false
	}
	var m meta
	if err := c.Get(ctx, c.P(append(strings.Split(collection, "/"), ref)...), &m); err != nil {
		return false
	}
	return m.ID == id
}

func (c *Client) keepRef(ctx context.Context, collection string, prior types.String, id string) types.String {
	if !prior.IsNull() && !prior.IsUnknown() && c.sameRef(ctx, collection, prior.ValueString(), id) {
		return prior
	}
	return types.StringValue(id)
}

func (c *Client) keepRefSet(ctx context.Context, collection string, prior types.Set, ids []string) types.Set {
	if prior.IsNull() || prior.IsUnknown() {
		return fromSet(ids)
	}
	var refs []string
	if prior.ElementsAs(ctx, &refs, false).HasError() || len(refs) != len(ids) {
		return fromSet(ids)
	}
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	for _, r := range refs {
		matched := false
		for id := range want {
			if c.sameRef(ctx, collection, r, id) {
				delete(want, id)
				matched = true
				break
			}
		}
		if !matched {
			return fromSet(ids)
		}
	}
	return prior
}

func sortedCopy(s []string) []string {
	out := append([]string(nil), s...)
	sort.Strings(out)
	return out
}

// addErr reports a failed API call, with a hint for the usual first mistakes.
func addErr(d *diag.Diagnostics, what string, err error) {
	var e *APIError
	detail := err.Error()
	if errors.As(err, &e) {
		switch e.Code {
		case "Unauthenticated":
			detail += "\n\nThe token is the secret of an access key: set token in the provider block or LAB_TOKEN. The Cloud panel of the page shows the first key of project default."
		case "QuotaExceeded":
			detail += "\n\nEvery VM is a real emulated machine in this browser tab; quotas follow the tab's memory. GET /v1/projects/<project>/quotas shows the limits."
		case "Unavailable":
			detail += "\n\nThis page cannot boot machines (the VM backend is not available here)."
		}
	}
	d.AddError("lab: cannot "+what, detail)
}
