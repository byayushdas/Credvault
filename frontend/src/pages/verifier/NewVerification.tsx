import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import type { Schema, RequestItem } from "../../services/api";
import { useResource, useSession } from "../../services/session";
import {
  PageHead,
  Field,
  Form,
  useAction,
  ErrorBox,
} from "../../components/common/UI";
import { QrScanner } from "../../components/common/QrScanner";
import type { VaultScanResult } from "../../components/common/QrScanner";
interface Match {
  id: string;
  issuer: string;
  issued_at: string;
  version: number;
  fields: string[];
}
export default function NewVerification() {
  const schemas = useResource<Record<string, Schema>>("/schemas"),
    { user } = useSession(),
    navigate = useNavigate(),
    action = useAction();
  const [step, setStep] = useState(1),
    [owner, setOwner] = useState(""),
    [shareToken, setShareToken] = useState<string | null>(null),
    [targetVault, setTargetVault] = useState<{ vault_id: string; masked_name: string } | null>(null),
    [isScanning, setIsScanning] = useState(false),
    [scanError, setScanError] = useState(""),
    [type, setType] = useState("GENERAL"),
    [fields, setFields] = useState<string[]>([]),
    [purpose, setPurpose] = useState(""),
    [hours, setHours] = useState(24),
    [key] = useState(() => crypto.randomUUID());
  async function next() {
    if (step === 1) {
      if (!/^CV-[0-9a-fA-F-]{36}$/.test(owner)) {
        return;
      }
      await action.run(async () => {
        const confirmRes = await api<{ vault_id: string; masked_name: string }>(
          "/owners/confirm?vault_id=" + encodeURIComponent(owner)
        );
        setTargetVault(confirmRes);
        setOwner(confirmRes.vault_id);
        setStep(2);
      }, "Owner vault confirmed");
    } else if (step === 2 && fields.length && purpose.trim().length >= 8) {
      setStep(3);
    }
  }

  const handleScan = async (res: VaultScanResult) => {
    try {
      setScanError("");
      let confirmRes;
      if (res.source === "QR_SHARE" && res.token) {
        confirmRes = await api<{ vault_id: string; masked_name: string, token: string }>(
          "/owners/confirm-share?token=" + encodeURIComponent(res.token)
        );
        setShareToken(confirmRes.token);
      } else if (res.vault_id) {
        confirmRes = await api<{ vault_id: string; masked_name: string }>(
          "/owners/confirm?vault_id=" + encodeURIComponent(res.vault_id)
        );
        setShareToken(null);
      } else {
        throw new Error("Invalid scan result");
      }
      setTargetVault(confirmRes);
      setOwner(confirmRes.vault_id);
      setIsScanning(false);
      setStep(2);
    } catch (e: any) {
      setScanError(e.message || "Failed to confirm vault");
    }
  };

  async function submit() {
    await action.run(async () => {
      const r = await api<RequestItem>(
        "/verification/requests/from-vault",
        "POST",
        {
          vault_id: owner,
          credential_type: type,
          fields,
          purpose,
          lifetime_hours: hours,
          share_token: shareToken
        },
        key,
      );
      navigate("/verifier/requests/" + r.id);
    }, "Request submitted");
  }
  return (
    <>
      <PageHead
        title="New Verification"
        description="Request only the information you need, for a stated purpose."
      />
      <ol className="stepper">
        {[
          "Identify owner",
          "Select fields",
          "Review and submit",
        ].map((s, i) => (
          <li
            key={s}
            aria-current={step === i + 1 ? "step" : undefined}
            className={step === i + 1 ? "current" : step > i + 1 ? "done" : ""}
          >
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      <section className="card form-card">
        <ErrorBox message={schemas.error} retry={schemas.reload} />
        {action.feedback}
        <Form onSubmit={() => (step === 3 ? void submit() : void next())}>
          {step === 1 && (
            <>
              <h2>Identify the owner</h2>
              <p>
                Ask the owner to share their Vault QR or enter their exact vault ID.
              </p>
              
              {!isScanning ? (
                <div className="card" style={{ padding: "1.5rem", background: "var(--bg-card-alt)", borderRadius: "var(--radius)", marginBottom: "1rem" }}>
                  <h3 style={{ marginTop: 0 }}>Target Vault</h3>
                  <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>Identify the owner vault to verify.</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input 
                      placeholder="Enter Vault ID (CV-...)" 
                      value={owner}
                      onChange={(e) => setOwner(e.target.value.trim())}
                      pattern="^CV-[0-9a-fA-F-]{36}$"
                      title="Vault ID must start with CV- followed by a 36-character valid identifier"
                      style={{ flex: 1 }}
                      required
                    />
                  </div>
                  
                  <div style={{ textAlign: "center", margin: "1rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>OR</div>
                  
                  <button type="button" className="secondary" onClick={() => setIsScanning(true)} style={{ width: "100%" }}>
                    Scan Owner QR
                  </button>
                </div>
              ) : (
                <div className="scanner-container card" style={{ marginBottom: "1rem" }}>
                  <QrScanner
                    onScan={handleScan}
                    onCancel={() => { setIsScanning(false); setScanError(""); }}
                  />
                  {scanError && <p className="error" style={{ color: "red", marginTop: "1rem" }}>{scanError}</p>}
                </div>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <h2>Select fields and purpose</h2>
              {targetVault && (
                <div className="target-vault-info card" style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-card-alt)", borderRadius: "var(--radius)" }}>
                  <h3 style={{ marginTop: 0 }}>Target Vault</h3>
                  <p className="monospace" style={{ margin: "0.5rem 0" }}>{targetVault.vault_id}</p>
                  <p style={{ margin: "0.5rem 0" }}>Owner: <strong>{targetVault.masked_name}</strong></p>
                </div>
              )}
              
              <Field label="Credential type">
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setFields([]);
                  }}
                >
                  {Object.entries(schemas.data || {}).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>

              <fieldset>
                <legend>Requested fields (at least one)</legend>
                {Object.entries(schemas.data?.[type]?.fields || {})
                  .map(([k, s]) => (
                    <label className="checkbox" key={k}>
                      <input
                        type="checkbox"
                        checked={fields.includes(k)}
                        onChange={(e) =>
                          setFields(
                            e.target.checked
                              ? [...fields, k]
                              : fields.filter((f) => f !== k),
                          )
                        }
                      />
                      {s.label}
                    </label>
                  ))}
              </fieldset>
              <Field label="Purpose">
                <textarea
                  required
                  minLength={8}
                  maxLength={500}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Explain why these fields are needed"
                />
              </Field>
              <Field label="Request lifetime">
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                >
                  <option value={1}>1 hour</option>
                  <option value={24}>24 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Review your request</h2>
              <dl className="claim-list">
                <div>
                  <dt>Organisation</dt>
                  <dd>{user!.organization?.name}</dd>
                </div>
                <div>
                  <dt>Target Vault</dt>
                  <dd>
                    <code>{owner}</code>
                    <br/>
                    <small>Owner: {targetVault?.masked_name}</small>
                  </dd>
                </div>
                <div>
                  <dt>Credential type</dt>
                  <dd>{schemas.data?.[type]?.label}</dd>
                </div>
                <div>
                  <dt>Fields</dt>
                  <dd>
                    {fields
                      .map((f) => schemas.data?.[type]?.fields[f]?.label)
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Purpose</dt>
                  <dd>{purpose}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{hours} hours after submission</dd>
                </div>
              </dl>
              <p>
                The owner's rules may approve, deny or hold individual fields
                for review.
              </p>
            </>
          )}
          <div className="form-footer">
            <button
              type="button"
              className="secondary"
              disabled={step === 1 || action.busy}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
            <button
              className="primary"
              disabled={
                action.busy ||
                (step === 2 && (!fields.length || purpose.trim().length < 8))
              }
            >
              {action.busy
                ? "Submitting…"
                : step === 3
                  ? "Submit request"
                  : "Next"}
            </button>
          </div>
        </Form>
      </section>
    </>
  );
}
