import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, fileContent, label } from "../../services/api";
import type { Doc, Schema } from "../../services/api";
import { useResource } from "../../services/session";
import {
  PageHead,
  Field,
  Form,
  useAction,
  DateText,
  ErrorBox,
} from "../../components/common/UI";
import { QrScanner } from "../../components/common/QrScanner";
import type { VaultScanResult } from "../../components/common/QrScanner";

interface IssueData {
  vault_id: string;
  title: string;
  type: string;
  claims: Record<string, string | number | boolean>;
  issued_at: string;
  expires_at: string | null;
  attachment?: { content: string };
  replaces_id?: string;
  draft_id?: string;
}
interface Draft {
  id: string;
  updated_at: string;
  data: IssueData;
}

export default function IssueDocument() {
  const [params] = useSearchParams(),
    navigate = useNavigate(),
    schemas = useResource<Record<string, Schema>>("/schemas"),
    drafts = useResource<Draft[]>("/issuer/drafts"),
    action = useAction();
  const [data, setData] = useState<IssueData>(() => ({
    vault_id: "",
    title: "",
    type: "GENERAL",
    claims: {},
    issued_at: new Date().toISOString(),
    expires_at: null,
    ...(params.get("replace") ? { replaces_id: params.get("replace")! } : {}),
  }));
  const [review, setReview] = useState(false),
    [draftId, setDraftId] = useState<string>(() => crypto.randomUUID()),
    [key, setKey] = useState<string>(() => crypto.randomUUID()),
    [attachmentName, setAttachmentName] = useState(""),
    [loadError, setLoadError] = useState("");
  const [savedDraft, setSavedDraft] = useState(false);
  const [confirmedOwner, setConfirmedOwner] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [targetVault, setTargetVault] = useState<{ vault_id: string; masked_name: string } | null>(null);
  const [scanError, setScanError] = useState("");
  const replacement = params.get("replace");
  useEffect(() => {
    if (!replacement) return;
    let active = true;
    api<Doc>("/documents/" + replacement)
      .then((d) => {
        if (active)
          setData((v) => ({
            ...v,
            vault_id: "", // Requires re-scan for replacement
            title: d.title,
            type: d.type,
            claims: d.claims || {},
            replaces_id: d.id,
          }));
      })
      .catch((e) => setLoadError(e.message));
    return () => {
      active = false;
    };
  }, [replacement]);
  const fields = schemas.data?.[data.type]?.fields || {};
  const attachmentContent = data.attachment?.content || "";
  const fileType = attachmentContent.startsWith("iVBORw0KGgo")
    ? "image/png"
    : attachmentContent.startsWith("/9j/")
      ? "image/jpeg"
      : attachmentContent.startsWith("JVBERi0")
        ? "application/pdf"
        : null;
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!fileType || !attachmentContent) {
      setAttachmentPreview(null);
      return;
    }
    try {
      const bin = atob(attachmentContent);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: fileType }));
      setAttachmentPreview(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setAttachmentPreview(null);
    }
  }, [fileType, attachmentContent]);
  function update<K extends keyof IssueData>(key: K, value: IssueData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }
  async function saveDraft() {
    await action.run(async () => {
      await api("/issuer/drafts/" + draftId, "PUT", data);
      setSavedDraft(true);
    }, "Encrypted draft saved.");
  }
  async function issue() {
    await action.run(async () => {
      const payload = {
        ...data,
        ...(savedDraft ? { draft_id: draftId } : {}),
      };
      const doc = await api<Doc>("/issuer/documents/issue-to-vault", "POST", payload, key);
      navigate("/issuer/documents/" + doc.id);
    }, "Signed credential issued to vault");
  }
  async function reviewCredential() {
    setReview(true);
  }

  const handleScan = async (res: VaultScanResult) => {
    try {
      setScanError("");
      const confirmRes = await api<{ vault_id: string; masked_name: string; status: string }>(
        "/owners/confirm?vault_id=" + encodeURIComponent(res.vault_id)
      );
      setTargetVault(confirmRes);
      update("vault_id", confirmRes.vault_id);
      setIsScanning(false);
    } catch (e: any) {
      setScanError(e.message || "Failed to confirm vault");
    }
  };
  async function loadDraft(d: Draft) {
    const draftData = d.data as any;
    const vId = draftData.vault_id || draftData.owner_id || "";
    setData({ ...d.data, vault_id: vId });
    setDraftId(d.id);
    setSavedDraft(true);
    setKey(crypto.randomUUID());
    setReview(false);
    setAttachmentName(d.data.attachment ? "Saved attachment" : "");
    if (vId) {
      try {
        const confirmRes = await api<{ vault_id: string; masked_name: string; status: string }>(
          "/owners/confirm?vault_id=" + encodeURIComponent(vId)
        );
        setTargetVault(confirmRes);
      } catch {}
    }
  }
  return (
    <>
      <PageHead
        title={
          replacement ? "Create replacement credential" : "Issue Credential"
        }
        description="Issue immutable claims to an exact owner reference. Drafts remain editable until issuance."
      />
      <ErrorBox message={loadError || schemas.error} retry={schemas.reload} />
      {action.feedback}
      <div className="issue-grid">
        <section className="card">
          <h2>{review ? "Review before signing" : "Credential information"}</h2>
          <Form
            onSubmit={() => (review ? void issue() : void reviewCredential())}
          >
            {!review ? (
              <>
                {!targetVault ? (
                  <div style={{ marginBottom: "1rem" }}>
                    {!isScanning ? (
                      <div className="card" style={{ padding: "1.5rem", background: "var(--bg-card-alt)", borderRadius: "var(--radius)" }}>
                        <h3 style={{ marginTop: 0 }}>Target Vault</h3>
                        <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>Identify the owner vault to issue this credential to.</p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <input 
                            placeholder="Enter Vault ID (CV-...)" 
                            value={data.vault_id}
                            onChange={(e) => update("vault_id", e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button 
                            type="button" 
                            className="primary" 
                            onClick={() => handleScan({ vault_id: data.vault_id, source: "manual" })}
                            disabled={!data.vault_id}
                          >
                            Lookup
                          </button>
                        </div>
                        
                        <div style={{ textAlign: "center", margin: "1rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>OR</div>
                        
                        <button type="button" className="secondary" onClick={() => setIsScanning(true)} style={{ width: "100%" }}>
                          Scan Owner QR
                        </button>
                      </div>
                    ) : (
                      <div className="scanner-container card">
                        <QrScanner
                          onScan={handleScan}
                          onCancel={() => { setIsScanning(false); setScanError(""); }}
                        />
                        {scanError && <p className="error" style={{ color: "red", marginTop: "1rem" }}>{scanError}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="target-vault-info card" style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-card-alt)", borderRadius: "var(--radius)" }}>
                      <h3 style={{ marginTop: 0 }}>Target Vault</h3>
                      <p className="monospace" style={{ margin: "0.5rem 0" }}>{targetVault.vault_id}</p>
                      <p style={{ margin: "0.5rem 0" }}>Owner: <strong>{targetVault.masked_name}</strong></p>
                      <button type="button" className="secondary" onClick={() => { setTargetVault(null); update("vault_id", ""); setIsScanning(true); }}>
                        Change Vault
                      </button>
                    </div>
                    <div className="form-grid">
                      <Field label="Credential type">
                        <select
                          value={data.type}
                          onChange={(e) => {
                            update("type", e.target.value);
                            update("claims", {});
                          }}
                        >
                          {Object.entries(schemas.data || {}).map(([k, s]) => (
                            <option key={k} value={k}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                <Field label="Title">
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    value={data.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                </Field>
                <div className="form-grid">
                  {Object.entries(fields).map(([k, s]) => (
                    <Field label={s.label} key={k}>
                      {s.type === "boolean" ? (
                        <select
                          required
                          value={
                            data.claims[k] === undefined
                              ? ""
                              : String(data.claims[k])
                          }
                          onChange={(e) =>
                            update("claims", {
                              ...data.claims,
                              [k]: e.target.value === "true",
                            })
                          }
                        >
                          <option value="">Choose assessment…</option>
                          <option value="true">Yes — 18 or older</option>
                          <option value="false">No — below 18</option>
                        </select>
                      ) : (
                        <input
                          required
                          type={
                            s.type === "number"
                              ? "number"
                              : s.type === "date"
                                ? "date"
                                : "text"
                          }
                          min={s.type === "number" ? 0 : undefined}
                          max={
                            s.type === "number"
                              ? k === "cgpa"
                                ? 10
                                : k === "semester"
                                  ? 20
                                  : 100
                              : undefined
                          }
                          maxLength={300}
                          step={
                            s.type === "number"
                              ? k === "semester"
                                ? 1
                                : "0.01"
                              : undefined
                          }
                          value={String(data.claims[k] ?? "")}
                          onChange={(e) =>
                            update("claims", {
                              ...data.claims,
                              [k]:
                                s.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
                </div>
                {data.type === "AGE" && (
                  <p className="notice">
                    Attest to the threshold after your organisation's
                    assessment. No birth date is stored. Age claims must expire
                    within 365 days of assessment.
                  </p>
                )}
                <div className="form-grid">
                  <Field label="Issue date and time (Local)">
                    <input
                      required
                      type="datetime-local"
                      value={(() => {
                        if (!data.issued_at) return "";
                        const d = new Date(data.issued_at);
                        if (isNaN(d.getTime())) return "";
                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                        return d.toISOString().slice(0, 16);
                      })()}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        if (!isNaN(d.getTime())) {
                          update("issued_at", d.toISOString());
                        }
                      }}
                    />
                  </Field>
                  <Field
                    label="Expiry date and time (Local)"
                    hint={
                      data.type === "AGE"
                        ? "Required for age attestations."
                        : "Optional — leave blank for no expiry."
                    }
                  >
                    <input
                      required={data.type === "AGE"}
                      type="datetime-local"
                      value={(() => {
                        if (!data.expires_at) return "";
                        const d = new Date(data.expires_at);
                        if (isNaN(d.getTime())) return "";
                        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                        return d.toISOString().slice(0, 16);
                      })()}
                      onChange={(e) => {
                        if (!e.target.value) {
                          update("expires_at", null);
                        } else {
                          const d = new Date(e.target.value);
                          if (!isNaN(d.getTime())) {
                            update("expires_at", d.toISOString());
                          }
                        }
                      }}
                    />
                  </Field>
                </div>
                <section
                  className="credential-upload"
                  aria-labelledby="credential-upload-title"
                >
                  <h3 id="credential-upload-title">Upload credential image</h3>
                  <p className="muted">
                    Attach a scan or photo of the certificate. It will be saved
                    with the signed credential in the owner's vault.
                  </p>
                  <Field
                    label="Attachment (optional)"
                    hint="One PNG or JPEG image, or a PDF · up to 10 MB"
                  >
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                      disabled={action.busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file)
                          void action.run(async () => {
                            const attachment = await fileContent(file);
                            if (
                              !attachment.content.startsWith("iVBORw0KGgo") &&
                              !attachment.content.startsWith("/9j/") &&
                              !attachment.content.startsWith("JVBERi0")
                            )
                              throw new Error(
                                "Choose a PNG or JPEG image, or a PDF.",
                              );
                            update("attachment", attachment);
                            setAttachmentName(file.name);
                          }, "Attachment ready for review");
                      }}
                    />
                  </Field>
                  {attachmentPreview && fileType === "application/pdf" ? (
                    <iframe
                      className="credential-image-preview"
                      src={attachmentPreview}
                      title="Selected credential attachment"
                    />
                  ) : attachmentPreview ? (
                    <img
                      className="credential-image-preview"
                      src={attachmentPreview}
                      alt="Selected credential attachment"
                    />
                  ) : null}
                  {attachmentName && (
                    <p>
                      {attachmentName}{" "}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          update("attachment", undefined);
                          setAttachmentName("");
                        }}
                      >
                        Remove attachment
                      </button>
                    </p>
                  )}
                </section>
                </>
              )}
              </>
            ) : (
              <>
                <dl className="claim-list">
                  <div>
                    <dt>Title</dt>
                    <dd>{data.title}</dd>
                  </div>
                  <div>
                    <dt>Target Vault</dt>
                    <dd>
                      <code>{data.vault_id}</code>
                      <br/>
                      <small>
                        Confirmed active owner vault. Owner: {targetVault?.masked_name}
                      </small>
                    </dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{schemas.data?.[data.type]?.label}</dd>
                  </div>
                  {Object.entries(data.claims).map(([k, v]) => (
                    <div key={k}>
                      <dt>{label(k)}</dt>
                      <dd>{String(v)}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Issued</dt>
                    <dd>{new Date(data.issued_at).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{data.expires_at ? new Date(data.expires_at).toLocaleString() : "No expiry"}</dd>
                  </div>
                  <div>
                    <dt>Attachment</dt>
                    <dd>{attachmentName || "None"}</dd>
                  </div>
                </dl>
                {attachmentPreview && (
                  <img
                    className="credential-image-preview"
                    src={attachmentPreview}
                    alt="Credential attachment to be issued"
                  />
                )}
                <p className="notice">
                  Confirming signs and encrypts this credential, records
                  issuance and delivers it to the owner's vault. Corrections
                  require a replacement version.
                </p>
              </>
            )}
            <div className="form-footer">
              <div className="actions">
                {review ? (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setReview(false)}
                  >
                    Back to edit
                  </button>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    disabled={action.busy}
                    onClick={() => void saveDraft()}
                  >
                    Save draft
                  </button>
                )}
                <Link to="/issuer/documents">Cancel</Link>
              </div>
              <button
                className="primary"
                disabled={action.busy || !schemas.data}
              >
                {action.busy
                  ? "Saving…"
                  : review
                    ? "Confirm and issue"
                    : "Review credential"}
              </button>
            </div>
          </Form>
        </section>
        <aside className="card drafts">
          <h2>Saved drafts</h2>
          <p className="muted">
            Encrypted and visible to your issuer organisation.
          </p>
          <ErrorBox message={drafts.error} retry={drafts.reload} />
          {drafts.data?.length ? (
            drafts.data.map((d) => (
              <div className="draft" key={d.id}>
                <strong>{d.data.title || "Untitled draft"}</strong>
                <small>
                  <DateText value={d.updated_at} />
                </small>
                <div className="actions">
                  <button className="text-button" onClick={() => loadDraft(d)}>
                    Edit draft
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        await api("/issuer/drafts/" + d.id, "DELETE");
                        if (d.id === draftId) setSavedDraft(false);
                      }, "Draft deleted")
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>No drafts saved.</p>
          )}
        </aside>
      </div>
    </>
  );
}
