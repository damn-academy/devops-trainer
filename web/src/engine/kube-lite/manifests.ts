// Reading manifests as kubectl does: several YAML documents separated by
// `---`, JSON, `kind: List`; parse errors in kubectl's wording with the line.

import YAML from 'yaml';
import { isObj, type Obj } from './util';

export class ManifestError extends Error {}

export function parseManifests(text: string, file: string): Obj[] {
  const out: Obj[] = [];
  let docs: YAML.Document.Parsed[];
  try {
    docs = YAML.parseAllDocuments(text) as YAML.Document.Parsed[];
  } catch (e) {
    throw new ManifestError(`error: error parsing ${file}: ${(e as Error).message}`);
  }
  if (!Array.isArray(docs)) docs = [docs as unknown as YAML.Document.Parsed];
  for (const d of docs) {
    if (d.errors?.length) {
      const err = d.errors[0];
      const line = err.linePos?.[0]?.line ?? 1;
      const what = /Implicit map keys need to be followed by map values|Nested mappings are not allowed in compact mappings|Implicit keys need to be on a single line/.test(err.message)
        ? 'mapping values are not allowed in this context'
        : /All mapping items must start at the same column|Implicit map keys need to be on a single line/.test(err.message)
          ? 'did not find expected key'
          : /tab/i.test(err.message)
            ? 'found character that cannot start any token'
            : 'could not find expected \':\'';
      throw new ManifestError(`error: error parsing ${file}: error converting YAML to JSON: yaml: line ${line}: ${what}`);
    }
    const v = d.toJS();
    if (v === null || v === undefined) continue;
    if (!isObj(v)) throw new ManifestError(`error: error validating "${file}": error validating data: invalid object to validate; if you choose to ignore these errors, turn validation off with --validate=false`);
    if (v.kind === 'List' && Array.isArray(v.items)) out.push(...v.items);
    else out.push(v);
  }
  return out;
}

/** Fields that are not part of the schema, as kubectl's client-side validation reports them. */
export function unknownTopFields(o: Obj): string[] {
  const known = new Set(['apiVersion', 'kind', 'metadata', 'spec', 'status', 'data', 'stringData', 'binaryData', 'type', 'immutable', 'addressType', 'endpoints', 'ports', 'subsets', 'rules', 'roleRef', 'subjects']);
  return Object.keys(o).filter((k) => !known.has(k));
}
