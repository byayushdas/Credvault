import { useState } from "react";
import { label, downloadJson } from "../../services/api";
import type { Audit } from "../../services/api";
import { useResource } from "../../services/session";
import {
  PageHead,
  Loading,
  ErrorBox,
  Field,
  DateText,
  Status,
  Empty,
  Modal,
  Pager,
  pageRows,
} from "../../components/common/UI";
export default function AuditLog() {
  const r = useResource<Audit[]>("/audit"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [detail, setDetail] = useState<Audit>(),
    [page, setPage] = useState(1);
  const rows = (r.data || []).filter(
    (e) =>
      (!filter || e.action === filter) &&
      JSON.stringify(e).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Audit Log"
        description="Append-only access metadata with a tamper-evident hash chain. Field values are never logged."
      >
        <button
          className="secondary"
          disabled={!rows.length}
          onClick={() => downloadJson(rows, "credvault-audit-metadata.json")}
        >
          Export filtered metadata
        </button>
      </PageHead>
      <section className="card">
        <div className="filters">
          <Field label="Search audit metadata">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Event, actor or reference"
            />
          </Field>
          <Field label="Event type">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All events</option>
              {[...new Set(r.data?.map((e) => e.action))].map((e) => (
                <option key={e} value={e}>
                  {label(e)}
                </option>
              ))}
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
                    <th>Event / time</th>
                    <th>Requested fields</th>
                    <th>Shared fields</th>
                    <th>Outcome</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows(rows, page).map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{label(e.action)}</strong>
                        <small>
                          <DateText value={e.created_at} />
                        </small>
                      </td>
                      <td>{e.requested.join(", ") || "—"}</td>
                      <td>{e.shared.join(", ") || "None"}</td>
                      <td>
                        <Status value={e.outcome} />
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setDetail(e)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={rows.length} setPage={setPage} />
          </>
        ) : (
          <Empty>No matching audit events.</Empty>
        )}
      </section>
      {detail && (
        <Modal
          title="Audit event metadata"
          onClose={() => setDetail(undefined)}
        >
          <pre>{JSON.stringify(detail, null, 2)}</pre>
        </Modal>
      )}
    </>
  );
}
