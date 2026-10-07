import { useState } from "react";
import { api, label } from "../../services/api";
import type { Rule, Doc, Org, Schema } from "../../services/api";
import { useResource } from "../../services/session";
import {
  PageHead,
  Loading,
  ErrorBox,
  Field,
  Modal,
  Form,
  useAction,
  Empty,
  Status,
  DateText,
  Pager,
  pageRows,
} from "../../components/common/UI";
const fresh: Rule = {
  verifier_id: null,
  credential_id: null,
  credential_type: null,
  field: "*",
  action: "ASK",
  enabled: true,
  expires_at: null,
};
function body(r: Rule) {
  return {
    ...(r.id ? { version: r.version } : {}),
    verifier_id: r.verifier_id,
    credential_id: r.credential_id,
    credential_type: r.credential_type,
    field: r.field,
    action: r.action,
    enabled: r.enabled,
    expires_at: r.expires_at,
  };
}
export default function ConsentRules() {
  const r = useResource<Rule[]>("/consent/rules"),
    docs = useResource<Doc[]>("/documents"),
    orgs = useResource<Org[]>("/registry"),
    schemas = useResource<Record<string, Schema>>("/schemas");
  const [edit, setEdit] = useState<Rule>(),
    [deleting, setDeleting] = useState<Rule>(),
    [filter, setFilter] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    action = useAction();
  const selectedType = edit?.credential_id
    ? docs.data?.find((d) => d.id === edit.credential_id)?.type
    : edit?.credential_type;
  const fields = selectedType
    ? Object.keys(schemas.data?.[selectedType]?.fields || {})
    : [
        ...new Set(
          Object.values(schemas.data || {}).flatMap((s) =>
            Object.keys(s.fields),
          ),
        ),
      ];
  const rows = (r.data || []).filter(
    (x) =>
      (!filter || (filter === "DISABLED" ? !x.enabled : x.action === filter)) &&
      (x.verifier + " " + x.document + " " + x.field)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function save() {
    if (!edit) return;
    await action.run(async () => {
      await api(
        "/consent/rules" + (edit.id ? "/" + edit.id : ""),
        edit.id ? "PUT" : "POST",
        body(edit),
      );
      setEdit(undefined);
    }, "Consent rule saved. Current rules are checked before every disclosure.");
  }
  return (
    <>
      <PageHead
        title="Consent Rules"
        description="Choose which fields a verifier may receive automatically, must ask for, or cannot receive."
      >
        <button className="primary" onClick={() => setEdit({ ...fresh })}>
          Create rule
        </button>
      </PageHead>
      {action.feedback}
      <div className="notice">
        An applicable Deny always wins. Otherwise document scope takes priority
        over credential type, then all credentials; exact verifier and field
        break ties. Conflicting equal scopes ask you. No rule means Ask me.
      </div>
      <section className="card">
        <div className="filters">
          <Field label="Search rules">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Filter action">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All rules</option>
              <option value="AUTO_APPROVE">Auto-approve</option>
              <option value="ASK">Ask me</option>
              <option value="DENY">Deny</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </Field>
        </div>
        <ErrorBox
          message={r.error || docs.error || orgs.error || schemas.error}
          retry={r.reload}
        />
        {r.loading ? (
          <Loading />
        ) : rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Verifier / scope</th>
                    <th>Field</th>
                    <th>Action</th>
                    <th>Expiry</th>
                    <th>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows(rows, page).map((x) => (
                    <tr key={x.id}>
                      <td>
                        <strong>{x.verifier}</strong>
                        <small>
                          {x.document}
                          {x.credential_type
                            ? " · " + label(x.credential_type)
                            : ""}
                        </small>
                      </td>
                      <td>{x.field === "*" ? "All fields" : label(x.field)}</td>
                      <td>
                        <Status value={x.action} />
                        <small>
                          {x.enabled ? "Enabled" : "Disabled"} · v{x.version}
                        </small>
                      </td>
                      <td>
                        <DateText value={x.expires_at} />
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            className="text-button"
                            disabled={action.busy || r.refreshing}
                            onClick={() => setEdit({ ...x })}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button"
                            disabled={action.busy || r.refreshing}
                            onClick={() =>
                              void action.run(
                                () =>
                                  api("/consent/rules/" + x.id, "PUT", {
                                    ...body(x),
                                    enabled: !x.enabled,
                                  }),
                                x.enabled ? "Rule disabled" : "Rule enabled",
                              )
                            }
                          >
                            {x.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            className="text-button danger-text"
                            disabled={action.busy || r.refreshing}
                            onClick={() => setDeleting(x)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} setPage={setPage} total={rows.length} />
          </>
        ) : (
          <Empty>No matching rules. New requests default to Ask me.</Empty>
        )}
      </section>
      {edit && (
        <Modal
          title={edit.id ? "Edit consent rule" : "Create consent rule"}
          onClose={() => setEdit(undefined)}
        >
          <Form onSubmit={() => void save()}>
            <Field label="Verifier">
              <select
                value={edit.verifier_id || ""}
                onChange={(e) =>
                  setEdit({ ...edit, verifier_id: e.target.value || null })
                }
              >
                <option value="">All approved verifiers</option>
                {orgs.data
                  ?.filter((o) => o.kind === "VERIFIER" && o.approved)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Credential document">
              <select
                value={edit.credential_id || ""}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    credential_id: e.target.value || null,
                    credential_type: null,
                    field: "*",
                  })
                }
              >
                <option value="">All matching credentials</option>
                {docs.data
                  ?.filter((d) => d.issuer_id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
              </select>
            </Field>
            {!edit.credential_id && (
              <Field label="Credential type">
                <select
                  value={edit.credential_type || ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      credential_type: e.target.value || null,
                      field: "*",
                    })
                  }
                >
                  <option value="">All types</option>
                  {Object.entries(schemas.data || {}).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Field">
              <select
                value={edit.field}
                onChange={(e) => setEdit({ ...edit, field: e.target.value })}
              >
                <option value="*">All fields in scope</option>
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {label(f)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Consent action">
              <select
                value={edit.action}
                onChange={(e) => setEdit({ ...edit, action: e.target.value })}
              >
                <option value="AUTO_APPROVE">Auto-approve</option>
                <option value="ASK">Ask me</option>
                <option value="DENY">Deny</option>
              </select>
            </Field>
            <Field label="Expiry date (optional, UTC)">
              <input
                type="date"
                value={edit.expires_at?.slice(0, 10) || ""}
                onChange={(e) =>
                  setEdit({ ...edit, expires_at: e.target.value || null })
                }
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={edit.enabled}
                onChange={(e) =>
                  setEdit({ ...edit, enabled: e.target.checked })
                }
              />
              Enabled
            </label>
            {action.feedback}
            <div className="actions">
              <button
                className="secondary"
                type="button"
                onClick={() => setEdit(undefined)}
              >
                Cancel
              </button>
              <button className="primary" disabled={action.busy}>
                Save rule
              </button>
            </div>
          </Form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete consent rule"
          onClose={() => setDeleting(undefined)}
        >
          <p>
            Requests will use the remaining rules. With no matching rule, they
            require manual approval.
          </p>
          {action.feedback}
          <button
            className="danger"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api(
                  "/consent/rules/" +
                    deleting.id +
                    "?version=" +
                    deleting.version,
                  "DELETE",
                );
                setDeleting(undefined);
              }, "Rule deleted")
            }
          >
            Confirm delete
          </button>
        </Modal>
      )}
    </>
  );
}
