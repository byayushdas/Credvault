import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fetchFile, downloadJson, label } from "../../services/api";
import type { Doc, Audit, RequestItem } from "../../services/api";
import { useResource, useSession } from "../../services/session";
import {
  PageHead,
  Loading,
  ErrorBox,
  Status,
  DateText,
  Field,
  Modal,
  Form,
  useAction,
} from "../../components/common/UI";
export default function DocumentDetails() {
  const { id } = useParams(),
    { user } = useSession(),
    r = useResource<Doc>("/documents/" + id),
    events = useResource<Audit[]>("/audit"),
    requests = useResource<RequestItem[]>(
      user?.role === "OWNER" ? "/verification/requests" : null,
    ),
    [preview, setPreview] = useState(""),
    [revoke, setRevoke] = useState(false),
    [reason, setReason] = useState(""),
    action = useAction(),
    d = r.data;
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  if (r.loading) return <Loading />;
  if (!d) return <ErrorBox message={r.error} retry={r.reload} />;
  return (
    <>
      <PageHead title={d.title} description={d.issuer + " · " + d.category}>
        <Link to={"/" + user!.role.toLowerCase() + "/documents"}>
          Back to documents
        </Link>
      </PageHead>
      {action.feedback}
      <section className="card">
        <div className="section-head">
          <h2>Credential details</h2>
          <Status value={d.status} />
        </div>
        <div className="detail-grid">
          <div>
            <small>Credential reference</small>
            <code>{d.id}</code>
          </div>
          <div>
            <small>Owner reference</small>
            <code>{d.owner_id}</code>
          </div>
          <div>
            <small>Issued</small>
            <DateText value={d.issued_at} />
          </div>
          <div>
            <small>Expires</small>
            <DateText value={d.expires_at} />
          </div>
          <div>
            <small>Digital signature</small>
            <strong>
              {d.signature_valid
                ? "Valid Ed25519 signature"
                : "Unsigned personal upload"}
            </strong>
          </div>
          <div>
            <small>Registry trust</small>
            <strong>
              {d.issuer_trusted
                ? "Approved issuer and active key"
                : "No active issuer trust"}
            </strong>
          </div>
        </div>
        {d.revoke_reason && (
          <p className="error">
            Revocation / replacement reason: {d.revoke_reason}
          </p>
        )}
        {d.replaces_id && (
          <p>
            Replaces{" "}
            <Link
              to={
                "/" + user!.role.toLowerCase() + "/documents/" + d.replaces_id
              }
            >
              {d.replaces_id}
            </Link>
          </p>
        )}
        <h2>Stored fields</h2>
        {Object.keys(d.claims || {}).length ? (
          <dl className="claim-list">
            {Object.entries(d.claims || {}).map(([k, v]) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>This personal attachment contains no issuer-verified claims.</p>
        )}
        <div className="actions">
          {d.has_file && (
            <>
              <button
                className="secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(
                    async () => setPreview(await fetchFile(d.id)),
                    "",
                  )
                }
              >
                Preview attachment
              </button>
              <button
                className="secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    const url = await fetchFile(d.id);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download =
                      "credential." +
                      (d.file_type === "application/pdf"
                        ? "pdf"
                        : d.file_type === "image/png"
                          ? "png"
                          : "jpg");
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }, "Attachment downloaded")
                }
              >
                Download
              </button>
            </>
          )}
          {d.signature_valid && (
            <button
              className="secondary"
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  async () =>
                    downloadJson(
                      await api("/documents/" + d.id + "/package"),
                      "credential-package.json",
                    ),
                  "Signed package downloaded",
                )
              }
            >
              Export signed package
            </button>
          )}
          {user!.role === "OWNER" && d.status === "UNVERIFIED" && (
            <button
              className="secondary"
              disabled={action.busy}
              onClick={() =>
                void action.run(
                  () => api("/documents/" + d.id + "/archive", "POST"),
                  "Personal document archived",
                )
              }
            >
              Archive personal upload
            </button>
          )}
          {user!.role === "ISSUER" && (
            <>
              <Link
                className="button secondary"
                to={"/issuer/issue?replace=" + d.id}
              >
                Create replacement
              </Link>
              {d.status === "VALID" && (
                <button className="danger" onClick={() => setRevoke(true)}>
                  Revoke
                </button>
              )}
            </>
          )}
        </div>
      </section>
      <section className="card">
        <h2>Credential history</h2>
        {user!.role === "OWNER" && (
          <>
            <h3>Associated requests</h3>
            <ErrorBox message={requests.error} retry={requests.reload} />
            {requests.data
              ?.filter((x) => x.credential_id === d.id)
              .map((x) => (
                <p key={x.id}>
                  <Link to={"/owner/requests/" + x.id}>
                    {x.organization} · {label(x.status)}
                  </Link>
                </p>
              ))}
            {requests.data &&
              !requests.data.some((x) => x.credential_id === d.id) && (
                <p>No requests for this credential.</p>
              )}
          </>
        )}
        {events.data
          ?.filter((e) => e.credential_id === d.id)
          .map((e) => (
            <div className="activity-row" key={e.id}>
              <span>
                {label(e.action)} · {label(e.outcome)}
              </span>
              <small>
                <DateText value={e.created_at} />
              </small>
            </div>
          ))}
      </section>
      {preview && (
        <Modal title="Attachment preview" onClose={() => setPreview("")}>
          {d.file_type === "application/pdf" ? (
            <iframe
              className="file-preview"
              src={preview}
              title="Credential PDF"
            />
          ) : (
            <img
              className="file-image"
              src={preview}
              alt="Credential attachment"
            />
          )}
        </Modal>
      )}
      {revoke && (
        <Modal title="Revoke credential" onClose={() => setRevoke(false)}>
          <p>
            Future disclosures will be blocked. Previously downloaded
            information cannot be erased.
          </p>
          <Form
            onSubmit={() =>
              void action.run(async () => {
                await api("/issuer/documents/" + d.id + "/revoke", "POST", {
                  reason,
                });
                setRevoke(false);
              }, "Credential revoked")
            }
          >
            <Field label="Reason">
              <textarea
                required
                minLength={5}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {action.feedback}
            <button className="danger" disabled={action.busy}>
              Confirm revocation
            </button>
          </Form>
        </Modal>
      )}
    </>
  );
}
