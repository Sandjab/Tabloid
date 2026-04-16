import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import type { DialectId, Relation, Table } from '@/types/schema';
import { buildSchema } from '@/utils/export-json';
import { importJSON } from '@/utils/import-json';

export const URL_HASH_PARAM = 's';

export interface ShareablePayload {
  tables: Table[];
  relations: Relation[];
  name: string;
  dialect: DialectId;
}

// Size above which we emit a console warning — URLs over ~8KB start to be
// rejected by some servers/clients, and a 30KB+ hash is user-hostile even when
// technically supported.
const SIZE_WARN_THRESHOLD = 8000;

export function encodeSchemaToHash(payload: ShareablePayload): string {
  const json = JSON.stringify(
    buildSchema(payload.tables, payload.relations, payload.name, payload.dialect),
  );
  const compressed = compressToEncodedURIComponent(json);
  return `${URL_HASH_PARAM}=${compressed}`;
}

export function decodeSchemaFromHash(hash: string): ShareablePayload | null {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(trimmed);
  const encoded = params.get(URL_HASH_PARAM);
  if (!encoded) return null;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const { tables, relations, name, dialect } = importJSON(json);
    return { tables, relations, name, dialect };
  } catch {
    return null;
  }
}

export function buildShareUrl(payload: ShareablePayload, baseUrl = window.location.href): string {
  const url = new URL(baseUrl);
  url.hash = encodeSchemaToHash(payload);
  const result = url.toString();
  if (result.length > SIZE_WARN_THRESHOLD) {
    console.warn(
      `Share URL is ${result.length} chars — may be rejected by some servers or truncated when copied.`,
    );
  }
  return result;
}

// Remove only the `s` parameter from the hash, leaving any other hash params
// intact so future features that share the hash (anchors, other tools) aren't
// clobbered by loading a shared schema.
export function clearShareHash(): void {
  if (!window.location.hash) return;
  const url = new URL(window.location.href);
  const params = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  if (!params.has(URL_HASH_PARAM)) return;
  params.delete(URL_HASH_PARAM);
  const remaining = params.toString();
  url.hash = remaining ? `#${remaining}` : '';
  window.history.replaceState(null, '', url.toString());
}
