import { useState } from "react";
import { api } from "../../services/api";
import type { Org } from "../../services/api";
import { useResource, useSession } from "../../services/session";
import {
  PageHead,
  DateText,
  Status,
  ErrorBox,
  Field,
  Form,
  useAction,
  Modal,
} from "../../components/common/UI";
interface Client {
  id: string;
  name: string;
  scopes: string;
  revoked: boolean;
}
export default function IssuerRegistry() {
  const { user, restore } = useSession(),
    r = useResource<Org[]>("/registry"),
    clients = useResource<Client[]>(
      user!.role === "VERIFIER" ? "/oauth/clients" : null,
    ),
    action = useAction(),
    [name, setName] = useState(user!.organization?.name || ""),
    [revoke, setRevoke] = useState<Client>();
  return (
    <>
      <PageHead
        title={
          user!.role === "ISSUER"
            ? "Organisation / Registry"
            : "Organisation / API Access"
        }
        description="Organisation approval and key management are controlled by the local administrator."
      />
      <section className="card form-card">
        <h2>Your organisation</h2>
        <p className="muted">
          Companies, hospitals, universities, government agencies and other
          organisations can issue or verify credentials here.
        </p>
        <Form
          onSubmit={() =>
            void action.run(async () => {
              await api("/organization", "PUT", { name });
              await restore();
            }, "Organisation updated")
          }
        >
          <Field label="Organisation display name">
            <input
              required
              minLength={3}
              maxLength={160}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {action.feedback}
          <button
            className="primary"
            disabled={action.busy || name === user!.organization?.name}
          >
            Save organisation
          </button>
        </Form>
      </section>
      {user!.role === "VERIFIER" && (
        <section className="card">
          <h2>OAuth2 API clients</h2>
          <p>
            Use the documented local administrator command to provision a
            confidential client. Its secret stays in a private server-side file.
            Access tokens expire after 10 minutes.
          </p>
          <ErrorBox message={clients.error} retry={clients.reload} />
          {clients.data?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Scopes</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.data.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        <small>
                          <code>{c.id}</code>
                        </small>
                      </td>
                      <td>{c.scopes}</td>
                      <td>
                        <Status value={c.revoked ? "REVOKED" : "VALID"} />
                      </td>
                      <td>
                        <button
                          className="secondary"
                          disabled={c.revoked}
                          onClick={() => setRevoke(c)}
                        >
                          Revoke client
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              No API clients provisioned. Browser verification remains
              available.
            </p>
          )}
        </section>
      )}
      <section className="card">
        <h2>Issuer registry</h2>
        <p className="muted">
          Public keys are retained for historical signature checks. A revoked
          key blocks future disclosure of every credential it signed.
        </p>
        <ErrorBox message={r.error} retry={r.reload} />
        {r.data
          ?.filter((o) => o.kind === "ISSUER")
          .map((o) => (
            <div key={o.id} className="registry-entry">
              <div className="section-head">
                <h3>{o.name}</h3>
                <Status value={o.approved ? "APPROVED" : "PENDING"} />
              </div>
              <code>{o.id}</code>
              {o.keys.map((k) => (
                <details key={k.id}>
                  <summary>
                    Key {k.id} ·{" "}
                    {k.revoked_at
                      ? "Revoked"
                      : k.valid_until
                        ? "Retired"
                        : "Active"}
                  </summary>
                  <p>
                    Valid from <DateText value={k.valid_from} /> · Until{" "}
                    <DateText value={k.valid_until} />
                  </p>
                  <pre>{k.public_key}</pre>
                </details>
              ))}
            </div>
          ))}
      </section>
      {revoke && (
        <Modal title="Revoke API client" onClose={() => setRevoke(undefined)}>
          <p>
            The client and all of its issued access tokens will stop working
            immediately.
          </p>
          {action.feedback}
          <button
            className="danger"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api("/oauth/clients/" + revoke.id + "/revoke", "POST");
                setRevoke(undefined);
              }, "Client revoked")
            }
          >
            Confirm revocation
          </button>
        </Modal>
      )}
    </>
  );
}
