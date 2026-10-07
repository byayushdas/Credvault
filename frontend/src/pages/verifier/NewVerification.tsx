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
    [type, setType] = useState("GENERAL"),
    [matches, setMatches] = useState<Match[]>([]),
    [credential, setCredential] = useState(""),
    [fields, setFields] = useState<string[]>([]),
    [purpose, setPurpose] = useState(""),
    [hours, setHours] = useState(24),
    [searched, setSearched] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  async function next() {
    if (step === 1) {
      if (!/^[0-9a-f-]{36}$/i.test(owner)) return;
      await action.run(async () => {
        await api("/owners/confirm?vault_id=" + encodeURIComponent(owner));
        setStep(2);
      }, "Owner vault confirmed");
    } else if (step === 2) {
      if (credential) setStep(3);
    } else if (step === 3 && fields.length && purpose.trim().length >= 8)
      setStep(4);
  }
  async function discover() {
    await action.run(async () => {
      const rows = await api<Match[]>(
        "/verification/discover?owner_id=" +
          encodeURIComponent(owner) +
          "&credential_type=" +
          type,
      );
      setMatches(rows);
      setCredential("");
      setSearched(true);
    }, "");
  }
  async function submit() {
    await action.run(async () => {
      const r = await api<RequestItem>(
        "/verification/requests",
        "POST",
        {
          owner_id: owner,
          credential_id: credential,
          fields,
          purpose,
          lifetime_hours: hours,
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
          "Choose credential",
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
        <Form onSubmit={() => (step === 4 ? void submit() : void next())}>
          {step === 1 && (
            <>
              <h2>Identify the owner</h2>
              <p>
                Ask the owner to share the exact vault ID from their dashboard.
                Private profiles are not searchable.
              </p>
              <Field label="Owner vault ID">
                <input
                  required
                  pattern="[0-9a-fA-F-]{36}"
                  value={owner}
                  onChange={(e) => {
                    setOwner(e.target.value.trim());
                    setCredential("");
                    setSearched(false);
                  }}
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <h2>Choose credential type</h2>
              <Field label="Credential type">
                <select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value);
                    setCredential("");
                    setFields([]);
                    setMatches([]);
                    setSearched(false);
                  }}
                >
                  {Object.entries(schemas.data || {}).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="secondary"
                type="button"
                disabled={action.busy}
                onClick={() => void discover()}
              >
                Find eligible credentials
              </button>
              {searched && !matches.length && (
                <p>
                  No valid credentials of this type are available for this
                  reference.
                </p>
              )}
              {matches.length > 0 && (
                <Field label="Select credential reference">
                  <select
                    required
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                  >
                    <option value="">Choose explicitly…</option>
                    {matches.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.issuer} · {m.issued_at.slice(0, 10)} ·{" "}
                        {m.id.slice(0, 8)} · v{m.version}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <p className="muted">
                This step exposes issuer, reference and issue date only.
              </p>
            </>
          )}
          {step === 3 && (
            <>
              <h2>Select fields and purpose</h2>
              <fieldset>
                <legend>Requested fields (at least one)</legend>
                {Object.entries(schemas.data?.[type]?.fields || {})
                  .filter(([name]) =>
                    matches
                      .find((match) => match.id === credential)
                      ?.fields.includes(name),
                  )
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
          {step === 4 && (
            <>
              <h2>Review your request</h2>
              <dl className="claim-list">
                <div>
                  <dt>Organisation</dt>
                  <dd>{user!.organization?.name}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>
                    <code>{owner}</code>
                  </dd>
                </div>
                <div>
                  <dt>Credential type</dt>
                  <dd>{schemas.data?.[type]?.label}</dd>
                </div>
                <div>
                  <dt>Reference</dt>
                  <dd>
                    <code>{credential}</code>
                  </dd>
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
                (step === 2 && !credential) ||
                (step === 3 && (!fields.length || purpose.trim().length < 8))
              }
            >
              {action.busy
                ? "Submitting…"
                : step === 4
                  ? "Submit request"
                  : "Next"}
            </button>
          </div>
        </Form>
      </section>
    </>
  );
}
