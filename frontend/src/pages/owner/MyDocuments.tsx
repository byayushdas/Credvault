import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Upload, Plus } from "lucide-react";
import { api, fileContent, label } from "../../services/api";
import type { Doc } from "../../services/api";
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
  Form,
  useAction,
  Pager,
  pageRows,
} from "../../components/common/UI";
export default function MyDocuments() {
  const { user } = useSession(),
    r = useResource<Doc[]>("/documents"),
    [params] = useSearchParams();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(params.get("category") || ""),
    [status, setStatus] = useState(params.get("status") || ""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [show, setShow] = useState(false),
    [title, setTitle] = useState(""),
    [file, setFile] = useState<File>(),
    [kind, setKind] = useState("personal");
  const action = useAction(),
    owner = user!.role === "OWNER",
    root = "/" + user!.role.toLowerCase();
  const rows = (r.data || [])
    .filter(
      (d) =>
        (!search ||
          (d.title + " " + d.issuer)
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!category || d.category === category) &&
        (!status ? d.status !== "ARCHIVED" : d.status === status),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.created_at.localeCompare(b.created_at)
          : b.created_at.localeCompare(a.created_at),
    );
  async function save() {
    if (!file) return;
    await action.run(
      async () => {
        if (kind === "signed") {
          await api(
            "/documents/import-package",
            "POST",
            JSON.parse(await file.text()),
          );
        } else {
          await api("/documents/import", "POST", {
            title,
            attachment: await fileContent(file),
          });
        }
        setShow(false);
        setTitle("");
        setFile(undefined);
      },
      kind === "signed"
        ? "Signed package validated."
        : "Personal document imported as unverified.",
    );
  }
  return (
    <>
      <PageHead
        title={owner ? "My Documents" : "Issued Credentials"}
        description={
          owner
            ? "Manage signed credentials and personal uploads."
            : "Credentials issued by your approved organisation."
        }
      >
        {owner ? (
          <button className="primary" onClick={() => setShow(true)}>
            <Upload size={16} />
            Import document
          </button>
        ) : (
          <Link className="primary button" to="/issuer/issue">
            <Plus size={16} />
            Issue credential
          </Link>
        )}
      </PageHead>
      {action.feedback}
      <section className="card">
        <div className="filters">
          <Field label="Search documents">
            <input
              value={search}
              placeholder="Title or issuer"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {[
                "General",
                "Employment",
                "Healthcare",
                "Education",
                "Identity",
                "Personal",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Active records</option>
              {[
                "VALID",
                "UNVERIFIED",
                "REVOKED",
                "EXPIRED",
                "SUPERSEDED",
                "ARCHIVED",
                "UNTRUSTED",
              ].map((x) => (
                <option key={x} value={x}>
                  {label(x)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort">
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
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
                    <th>Document</th>
                    <th>Issuer</th>
                    <th>Issued / expires</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows(rows, page).map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.title}</strong>
                        <small>
                          {d.category} · Version {d.version}
                        </small>
                      </td>
                      <td>{d.issuer}</td>
                      <td>
                        <DateText value={d.issued_at} />
                        <small>
                          Expires: <DateText value={d.expires_at} />
                        </small>
                      </td>
                      <td>
                        <Status value={d.status} />
                      </td>
                      <td>
                        <Link to={root + "/documents/" + d.id}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={rows.length} setPage={setPage} />
          </>
        ) : (
          <Empty>No documents match these filters.</Empty>
        )}
      </section>
      {show && (
        <Modal title="Import document" onClose={() => setShow(false)}>
          <p>
            Personal uploads remain unverified. Signed packages must be issued
            to your owner reference and registered in this vault.
          </p>
          <Form onSubmit={() => void save()}>
            <Field label="Import type">
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="personal">Personal PDF or image</option>
                <option value="signed">CredVault signed package (.json)</option>
              </select>
            </Field>
            {kind === "personal" && (
              <Field label="Document title">
                <input
                  required
                  minLength={3}
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
            )}
            <Field label="File">
              <input
                required
                type="file"
                accept={kind === "signed" ? ".json" : ".pdf,.png,.jpg,.jpeg"}
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </Field>
            {action.feedback}
            <div className="actions">
              <button
                className="secondary"
                type="button"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
              <button className="primary" disabled={action.busy}>
                Import
              </button>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
