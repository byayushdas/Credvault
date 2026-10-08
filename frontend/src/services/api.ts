export type Role = "OWNER" | "ISSUER" | "VERIFIER";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  organization: { id: string; name: string } | null;
  timezone: string;
  notifications: boolean;
  csrf: string;
}
export interface Doc {
  id: string;
  auto_fetch: boolean;
  owner_id: string;
  title: string;
  type: string;
  category: string;
  issuer: string;
  issuer_id: string | null;
  status: string;
  issued_at: string;
  expires_at: string | null;
  created_at: string;
  has_file: boolean;
  file_type: string | null;
  version: number;
  replaces_id: string | null;
  revoke_reason: string | null;
  claims?: Record<string, string | number | boolean>;
  signature_valid?: boolean;
  issuer_trusted?: boolean;
  key_id?: string;
}
export interface RequestItem {
  id: string;
  owner_id: string;
  organization: string;
  verifier_id: string;
  credential_id: string;
  credential_type: string;
  credential_status: string;
  purpose: string;
  status: string;
  created_at: string;
  expires_at: string;
  revision: number;
  fields: {
    field: string;
    decision: string;
    method: string;
    rules: { id: string; version: number; action: string }[];
  }[];
}
export interface Rule {
  id?: string;
  verifier_id: string | null;
  credential_id: string | null;
  credential_type: string | null;
  field: string;
  action: string;
  enabled: boolean;
  expires_at: string | null;
  verifier?: string;
  document?: string;
  version?: number;
}
export interface Schema {
  label: string;
  category: string;
  fields: Record<string, { label: string; type: string }>;
}
export interface Org {
  id: string;
  name: string;
  kind: string;
  approved: boolean;
  keys: {
    id: string;
    public_key: string;
    valid_from: string;
    valid_until: string | null;
    revoked_at: string | null;
  }[];
}
export interface Audit {
  id: number;
  event_id: string;
  created_at: string;
  actor_id: string;
  organization_id: string | null;
  owner_id: string | null;
  credential_id: string | null;
  request_id: string | null;
  action: string;
  requested: string[];
  shared: string[];
  outcome: string;
  method: string;
  hash: string;
  previous_hash: string;
}
export interface Dashboard {
  expired: number;
  revoked: number;
  documents: number;
  valid: number;
  pending: number;
  requests: number;
  approved: number;
  disclosures: number;
  recent_documents: Doc[];
  recent_requests: RequestItem[];
  recent_activity: Audit[];
}
export interface Notifications {
  unread: number;
  items: {
    id: string;
    message: string;
    link: string;
    read: boolean;
    created_at: string;
  }[];
}
export interface Result {
  request_id: string;
  credential_id: string;
  owner_id: string;
  issuer_id: string;
  issuer: string;
  key_id: string;
  public_key: string;
  algorithm: string;
  status: string;
  claims: {
    field: string;
    value: string | number | boolean;
    signed_payload: string;
    signature: string;
  }[];
  verified_at: string;
  expires_at: string;
}
let csrf = "";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response
    .json()
    .catch(() => ({ detail: "The server returned an unreadable response." }));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      typeof payload.detail === "string"
        ? payload.detail
        : "The operation failed. Please retry.",
      response.status,
    );
  }
  return payload as T;
}
export async function fileContent(file: File): Promise<{ content: string }> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a file up to 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { content: btoa(text) };
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export async function fetchFile(id: string) {
  const r = await fetch("/api/v1/documents/" + id + "/file", {
    cache: "no-store",
  });
  if (!r.ok) {
    if (r.status === 401) window.dispatchEvent(new Event("session-expired"));
    throw new Error((await r.json()).detail);
  }
  return URL.createObjectURL(await r.blob());
}
export function label(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/^./, (s) => s.toUpperCase());
}
export async function verifyResult(result: Result): Promise<boolean> {
  const registry = await api<Org[]>("/registry");
  const issuer = registry.find(
    (o) => o.id === result.issuer_id && o.kind === "ISSUER" && o.approved,
  );
  const registeredKey = issuer?.keys.find(
    (k) =>
      k.id === result.key_id &&
      !k.revoked_at &&
      k.public_key === result.public_key,
  );
  if (!registeredKey) return false;
  const bytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const pem = result.public_key
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "");
  const key = await crypto.subtle.importKey(
    "spki",
    bytes(pem),
    "Ed25519",
    false,
    ["verify"],
  );
  for (const c of result.claims) {
    const raw = bytes(c.signed_payload);
    const payload = JSON.parse(new TextDecoder().decode(raw));
    if (
      payload.signed_at &&
      (payload.signed_at < registeredKey.valid_from ||
        (registeredKey.valid_until &&
          payload.signed_at >= registeredKey.valid_until))
    )
      return false;
    if (
      payload.field !== c.field ||
      payload.value !== c.value ||
      payload.owner_id !== result.owner_id ||
      payload.credential_id !== result.credential_id ||
      payload.issuer_id !== result.issuer_id ||
      payload.key_id !== result.key_id
    )
      return false;
    if (!(await crypto.subtle.verify("Ed25519", key, bytes(c.signature), raw)))
      return false;
  }
  return result.claims.length > 0;
}
