import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../services/api";
import { ArrowRight } from "lucide-react";
import { useResource, useSession } from "../../services/session";
import type { Dashboard } from "../../services/api";
import {
  PageHead,
  Loading,
  ErrorBox,
  Status,
  DateText,
  Empty,
  useAction
} from "../../components/common/UI";

function VaultQRSection() {
  const [qrData, setQrData] = useState<{ vault_id: string; qr_payload: string } | null>(null);
  const action = useAction();

  useEffect(() => {
    api<{ success: boolean; data: { vault_id: string; qr_payload: string } }>("/vault/me/qr", "GET").then((res) => {
      if (res.success && res.data) setQrData(res.data);
    });
  }, []);

  if (!qrData) return <Loading />;

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <h2>MY CREDVAULT</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem', background: 'white', borderRadius: '8px', marginTop: '1rem' }}>
        <QRCodeSVG 
          value={qrData.qr_payload} 
          size={220} 
          level="H" 
          includeMargin={true}
          fgColor="#0f172a"
        />
        
        <code className="reference" style={{ marginTop: '1.5rem', fontSize: '1.1rem', wordBreak: 'break-all' }}>{qrData.vault_id}</code>
        
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'center' }}>
          <button
            className="secondary"
            onClick={() => void action.run(async () => navigator.clipboard.writeText(qrData.vault_id), "Vault ID copied")}
            disabled={action.busy}
          >
            Copy Vault ID
          </button>
        </div>
        <div style={{ marginTop: "1.5rem", color: "#64748b", textAlign: "center", maxWidth: "300px" }}>
          <p style={{ margin: "0.25rem 0" }}>Use this QR to identify your vault.</p>
          <p style={{ margin: "0.25rem 0" }}>It does not automatically grant access to your documents.</p>
        </div>
        {action.feedback}
      </div>
    </section>
  );
}
export default function OwnerDashboard() {
  const { user } = useSession(),
    r = useResource<Dashboard>("/dashboard"),
    d = r.data,
    root = "/" + user!.role.toLowerCase();
  const owner = user!.role === "OWNER",
    issuer = user!.role === "ISSUER";
  return (
    <>
      <PageHead
        title="Dashboard"
        description={
          "Welcome back, " +
          user!.name +
          ". " +
          (user!.organization?.name || "Your private credential workspace.")
        }
      >
        <Link
          className="primary button"
          to={
            issuer
              ? "/issuer/issue"
              : owner
                ? "/owner/documents"
                : "/verifier/new"
          }
        >
          {issuer
            ? "Issue credential"
            : owner
              ? "Open documents"
              : "New verification"}
          <ArrowRight size={16} />
        </Link>
      </PageHead>
      <ErrorBox message={r.error} retry={r.reload} />
      {r.loading ? (
        <Loading />
      ) : (
        d && (
          <>
            <div className="stats">
              {(issuer
                ? [
                    ["Issued credentials", d.documents, root + "/documents"],
                    [
                      "Valid credentials",
                      d.valid,
                      root + "/documents?status=VALID",
                    ],
                    [
                      "Expired credentials",
                      d.expired,
                      root + "/documents?status=EXPIRED",
                    ],
                    [
                      "Revoked credentials",
                      d.revoked,
                      root + "/documents?status=REVOKED",
                    ],
                  ]
                : owner
                  ? [
                      ["Documents", d.documents, root + "/documents"],
                      [
                        "Valid signed credentials",
                        d.valid,
                        root + "/documents?status=VALID",
                      ],
                      [
                        "Pending requests",
                        d.pending,
                        root + "/requests?status=PENDING",
                      ],
                      ["Completed disclosures", d.disclosures, "/audit"],
                    ]
                  : [
                      ["Total requests", d.requests, root + "/history"],
                      [
                        "Pending requests",
                        d.pending,
                        root + "/history?status=PENDING",
                      ],
                      ["Approved or partial", d.approved, root + "/history"],
                      ["Result accesses", d.disclosures, root + "/history"],
                    ]
              ).map(([title, value, to]) => (
                <Link to={String(to)} className="stat" key={title}>
                  <span>{title}</span>
                  <strong>{value}</strong>
                  <small>
                    View records <ArrowRight size={13} />
                  </small>
                </Link>
              ))}
            </div>
            {!issuer && (
              <section className="card">
                <div className="section-head">
                  <h2>
                    {owner
                      ? "Requests requiring your attention"
                      : "Recent verification requests"}
                  </h2>
                  <Link to={owner ? root + "/requests" : root + "/history"}>
                    View history
                  </Link>
                </div>
                {d.recent_requests.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Organisation / purpose</th>
                          <th>Fields</th>
                          <th>Status</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.recent_requests.map((x) => (
                          <tr key={x.id}>
                            <td>
                              <strong>{x.organization}</strong>
                              <small>{x.purpose}</small>
                            </td>
                            <td>
                              {x.fields.length}{" "}
                              {x.fields.length === 1 ? "field" : "fields"}
                            </td>
                            <td>
                              <Status value={x.status} />
                            </td>
                            <td>
                              <DateText value={x.created_at} />
                            </td>
                            <td>
                              <Link to={root + "/requests/" + x.id}>
                                Review
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>
                    {owner
                      ? "No requests need your attention."
                      : "No verification requests yet."}
                  </Empty>
                )}
              </section>
            )}
            {(owner || issuer) && (
              <section className="card">
                <div className="section-head">
                  <h2>Recent credentials</h2>
                  <Link to={root + "/documents"}>View all documents</Link>
                </div>
                {d.recent_documents.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Credential</th>
                          <th>Issuer</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.recent_documents.map((x) => (
                          <tr key={x.id}>
                            <td>
                              <strong>{x.title}</strong>
                              <small>Version {x.version}</small>
                            </td>
                            <td>{x.issuer}</td>
                            <td>
                              <Link
                                to={root + "/documents?category=" + x.category}
                              >
                                {x.category}
                              </Link>
                            </td>
                            <td>
                              <Status value={x.status} />
                            </td>
                            <td>
                              <Link to={root + "/documents/" + x.id}>View</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty>
                    Your credentials will appear here after issuance or import.
                  </Empty>
                )}
              </section>
            )}

            {owner && <VaultQRSection />}
          </>
        )
      )}
    </>
  );
}
