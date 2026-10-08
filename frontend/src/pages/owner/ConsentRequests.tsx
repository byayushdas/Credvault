import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, label, downloadJson, verifyResult } from "../../services/api";
import type { RequestItem, Result } from "../../services/api";
import { useResource, useSession } from "../../services/session";
import {
  PageHead,
  Loading,
  ErrorBox,
  Status,
  DateText,
  Empty,
  Field,
  Modal,
  useAction,
  Pager,
  pageRows,
} from "../../components/common/UI";
function RequestDetail({ id }: { id: string }) {
  const { user } = useSession(),
    r = useResource<RequestItem>("/verification/requests/" + id),
    owner = user!.role === "OWNER",
    action = useAction();
  const [confirm, setConfirm] = useState(false),
    [savedResult, setResult] = useState<{
      payload: Result;
      revision: number;
    }>(),
    [proof, setProof] = useState(""),
    [json, setJson] = useState(false);
  const d = r.data;
  const result =
    d &&
    savedResult?.revision === d.revision &&
    d.credential_status === "VALID" &&
    ["APPROVED", "PARTIAL"].includes(d.status)
      ? savedResult.payload
      : undefined;
  const pending = d?.fields.filter((f) => f.decision === "PENDING") || [];
  if (r.loading) return <Loading />;
  if (!d) return <ErrorBox message={r.error} retry={r.reload} />;
  async function loadResult() {
    await action.run(async () => {
      const value = await api<Result>(
        "/verification/requests/" + id + "/result",
      );
      const valid = await verifyResult(value);
      if (!valid)
        throw new Error(
          "Disclosed claim proof failed independent browser validation.",
        );
      setResult({ payload: value, revision: d!.revision });
      setProof("Every disclosed claim verified independently in this browser.");
    }, "");
  }
  return (
    <>
      <PageHead title="Verification request" description={d.organization}>
        <Link to={owner ? "/owner/requests" : "/verifier/history"}>
          Back to requests
        </Link>
      </PageHead>
      <section className="card">
        <div className="section-head">
          <h2>Request details</h2>
          <Status value={d.status} />
        </div>
        <p>
          <strong>Purpose:</strong> {d.purpose}
        </p>
        <div className="detail-grid">
          <div>
            <small>Request reference</small>
            <code>{d.id}</code>
          </div>
          <div>
            <small>Credential</small>
            {label(d.credential_type)} · <Status value={d.credential_status} />
          </div>
          <div>
            <small>Submitted</small>
            <DateText value={d.created_at} />
          </div>
          <div>
            <small>Request expires</small>
            <DateText value={d.expires_at} />
          </div>
          <div>
            <small>Owner reference</small>
            <code>{d.owner_id}</code>
          </div>
        </div>
        <h2>{d.organization} requested:</h2>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          {d.fields.map(f => label(f.field)).join(", ")}
        </p>
        
        {owner ? (
          <div className="decisions-grouped">
            {d.fields.filter((f) => f.decision === "APPROVED" && f.method !== "MANUAL").length > 0 && (
              <div className="decision-group">
                <h3>AUTO-APPROVED:</h3>
                <ul>
                  {d.fields.filter((f) => f.decision === "APPROVED" && f.method !== "MANUAL").map((f) => (
                    <li key={f.field}>{label(f.field)}</li>
                  ))}
                </ul>
              </div>
            )}

            {pending.length > 0 && d.credential_status === "VALID" && (
              <div className="decision-group">
                <h3>WAITING FOR APPROVAL:</h3>
                <ul className="pending-list">
                  {pending.map((f) => (
                    <li key={f.field} style={{ marginBottom: "1rem" }}>
                      <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{label(f.field)}</div>
                      <div className="actions" style={{ marginTop: 0 }}>
                        <button
                          className="primary"
                          disabled={action.busy}
                          onClick={() => void action.run(async () => {
                            await api("/verification/requests/" + id + "/decide", "POST", {
                              revision: d.revision,
                              decisions: { [f.field]: "APPROVED" }
                            });
                            r.reload();
                          }, `Approved ${label(f.field)}`)}
                        >
                          Approve
                        </button>
                        <button
                          className="secondary"
                          disabled={action.busy}
                          onClick={() => void action.run(async () => {
                            await api("/verification/requests/" + id + "/decide", "POST", {
                              revision: d.revision,
                              decisions: { [f.field]: "DENIED" }
                            });
                            r.reload();
                          }, `Denied ${label(f.field)}`)}
                        >
                          Deny
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {d.fields.filter((f) => f.decision === "DENIED" || (f.decision === "APPROVED" && f.method === "MANUAL")).length > 0 && (
              <div className="decision-group">
                <h3>Other finalized decisions:</h3>
                <ul>
                  {d.fields.filter((f) => f.decision === "DENIED" || (f.decision === "APPROVED" && f.method === "MANUAL")).map((f) => (
                    <li key={f.field}>
                      {label(f.field)} - <Status value={f.decision} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {action.feedback}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Requested field</th>
                    <th>Decision</th>
                    <th>Method / rule version</th>
                  </tr>
                </thead>
                <tbody>
                  {d.fields.map((f) => (
                    <tr key={f.field}>
                      <td>{label(f.field)}</td>
                      <td>
                        <Status value={f.decision} />
                      </td>
                      <td>
                        {label(f.method)}
                        {f.rules.map((x) => (
                          <small key={x.id}>
                            {x.id.startsWith("auto-fetch:")
                              ? "Document auto fetch: " + (x.action === "AUTO_APPROVE" ? "On" : "Off")
                              : "Rule " + x.id.slice(0, 8) + " v" + x.version + ": " + label(x.action)}
                          </small>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {action.feedback}
            <div className="actions">
              {d.status === "PENDING" && (
                <button
                  className="secondary"
                  disabled={action.busy}
                  onClick={() => setConfirm(true)}
                >
                  Cancel request
                </button>
              )}
              {["APPROVED", "PARTIAL"].includes(d.status) && (
                <button
                  className="primary"
                  disabled={action.busy}
                  onClick={() => void loadResult()}
                >
                  View result
                </button>
              )}
            </div>
          </>
        )}
        {d.credential_status !== "VALID" && (
          <p className="error">
            This credential is {label(d.credential_status).toLowerCase()}.
            Further disclosure is blocked.
          </p>
        )}
      </section>
      {result && (
        <section className="card" style={{ marginTop: "2rem" }}>
          <h2>Verification Result</h2>
          <p className="success">{proof}</p>
          
          <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "var(--bg-success-light, #ecfdf5)", borderRadius: "var(--radius)", color: "var(--success-text, #065f46)", border: "1px solid var(--success-border, #34d399)" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span>✓</span>
              <strong>Credential Valid</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span>✓</span>
              <strong>Issuer Verified</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✓</span>
              <strong>Signature Valid</strong>
            </div>
          </div>

          <h3 style={{ marginTop: "1.5rem" }}>Disclosed Information</h3>
          <dl className="claim-list" style={{ marginTop: "1rem", marginBottom: "1.5rem" }}>
            {result.claims.map((c) => (
              <div key={c.field}>
                <dt>{label(c.field)}</dt>
                <dd>{String(c.value)}</dd>
              </div>
            ))}
          </dl>
          
          <h3 style={{ marginTop: "1.5rem" }}>Protected Information</h3>
          <p className="muted" style={{ fontStyle: "italic", marginTop: "0.5rem" }}>
            {d.fields.filter(f => f.decision !== "APPROVED").length} fields remained private.
          </p>

          <div className="actions" style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
            <button className="secondary" onClick={() => setJson(!json)}>
              {json ? "Hide JSON" : "Show JSON"}
            </button>
            <button
              className="secondary"
              onClick={() => downloadJson(result, "verification-result.json")}
            >
              Download result JSON
            </button>
          </div>
          {json && <pre>{JSON.stringify(result, null, 2)}</pre>}
        </section>
      )}
      {confirm && (
        <Modal
          title="Cancel verification request"
          onClose={() => setConfirm(false)}
        >
          <p>The owner will no longer be able to approve this request.</p>
          {action.feedback}
          <div className="actions">
            <button className="secondary" onClick={() => setConfirm(false)}>
              Back
            </button>
            <button
              className="danger"
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  async () => {
                    await api(
                      "/verification/requests/" + id + "/cancel",
                      "POST",
                    );
                    setConfirm(false);
                  },
                  "Request cancelled",
                )
              }
            >
              Confirm cancellation
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export default function ConsentRequests() {
  const { id } = useParams(),
    { user } = useSession(),
    [params] = useSearchParams(),
    r = useResource<RequestItem[]>(id ? null : "/verification/requests");
  const [search, setSearch] = useState(""),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState(""),
    [status, setStatus] = useState(params.get("status") || ""),
    [page, setPage] = useState(1),
    owner = user!.role === "OWNER";
  if (id) return <RequestDetail key={id} id={id} />;
  const rows = (r.data || []).filter(
    (x) =>
      (!fromDate || x.created_at.slice(0, 10) >= fromDate) &&
      (!toDate || x.created_at.slice(0, 10) <= toDate) &&
      (!status || x.status === status) &&
      (!search ||
        (x.organization + " " + x.purpose + " " + x.id)
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <>
      <PageHead
        title={owner ? "Verification Requests" : "Verification History"}
        description="Review exact fields, purpose, decisions and request expiry."
      >
        {!owner && (
          <Link className="primary button" to="/verifier/new">
            New verification
          </Link>
        )}
      </PageHead>
      <section className="card">
        <div className="filters">
          <Field label="Search requests">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Organisation, purpose or reference"
            />
          </Field>
          <Field label="Request status">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {[
                "PENDING",
                "APPROVED",
                "PARTIAL",
                "DENIED",
                "EXPIRED",
                "CANCELLED",
              ].map((x) => (
                <option value={x} key={x}>
                  {x === "PARTIAL" ? "Partially approved" : label(x)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Submitted from (UTC)">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Submitted through (UTC)">
            <input
              type="date"
              min={fromDate}
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        <ErrorBox message={r.error} retry={r.reload} />
        {r.loading ? (
          <Loading />
        ) : rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Organisation / purpose</th>
                    <th>Credential</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows(rows, page).map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.organization}</strong>
                        <small>{x.purpose}</small>
                      </td>
                      <td>
                        {label(x.credential_type)}
                        <small>
                          {x.fields.length} fields ·{" "}
                          {label(x.credential_status)}
                        </small>
                      </td>
                      <td>
                        <Status value={x.status} />
                      </td>
                      <td>
                        <DateText value={x.created_at} />
                      </td>
                      <td>
                        <Link
                          to={
                            "/" + user!.role.toLowerCase() + "/requests/" + x.id
                          }
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} setPage={setPage} total={rows.length} />
          </>
        ) : (
          <Empty>No requests match your filters.</Empty>
        )}
      </section>
    </>
  );
}
