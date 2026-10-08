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
  useAction,
  Modal,
} from "../../components/common/UI";

function VaultQRSection() {
  const [qrData, setQrData] = useState<{ vault_id: string; qr_payload: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [shareDuration, setShareDuration] = useState(10);
  const [shareVerifier, setShareVerifier] = useState("");
  const [shareQr, setShareQr] = useState<{qr_payload: string, expires_at: string} | null>(null);
  const action = useAction();

  useEffect(() => {
    api<{ success: boolean; data: { vault_id: string; qr_payload: string } }>("/vault/me/qr", "GET").then((res) => {
      if (res.success && res.data) setQrData(res.data);
    });
  }, []);

  if (!qrData) return <Loading />;

  const generateShareQr = async () => {
    const res = await api<{token: string, expires_at: string, qr_payload: string}>("/vault/me/share-token", "POST", {
      expires_in_minutes: shareDuration,
      verifier_id: shareVerifier || null
    });
    setShareQr(res);
  };


  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <h2>MY CREDVAULT</h2>
      <p style={{ margin: "1rem 0" }}>
        <small>Vault ID</small><br/>
        <code className="reference" style={{ display: 'inline-block', marginTop: '0.5rem', wordBreak: 'break-all' }}>{qrData.vault_id}</code>
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1rem' }}>
        <button className="primary" onClick={() => setFullscreen(true)}>Show My QR</button>
        <button className="secondary" onClick={() => setShareModal(true)}>Create Verification QR</button>
      </div>
      
      {fullscreen && (
        <Modal title="My QR screen" onClose={() => setFullscreen(false)}>
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', background: 'white', borderRadius: '8px' }}>
              <h3 style={{ marginBottom: "1.5rem", letterSpacing: "1px" }}>CREDVAULT</h3>
              
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
                <button className="secondary" onClick={() => {
                   const el = document.documentElement;
                   if (el.requestFullscreen) {
                     el.requestFullscreen();
                   }
                }}>
                  Fullscreen
                </button>
              </div>
              <div style={{ marginTop: "2rem", color: "#64748b", textAlign: "center", maxWidth: "300px" }}>
                <p style={{ margin: "0.25rem 0" }}>Use this QR to identify your vault.</p>
                <p style={{ margin: "0.25rem 0" }}>It does not automatically grant access to your documents.</p>
              </div>
              {action.feedback}
           </div>
        </Modal>
      )}
      
      {shareModal && (
        <Modal title="Create Verification QR" onClose={() => { setShareModal(false); setShareQr(null); }}>
          {!shareQr ? (
            <div className="form">
              <p>Generate a temporary, single-use QR for verification.</p>
              <label>
                Expiration
                <select value={shareDuration} onChange={e => setShareDuration(Number(e.target.value))}>
                  <option value={10}>10 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={1440}>24 hours</option>
                </select>
              </label>
              <label>
                Restrict to Specific Verifier (Optional)
                <input 
                  placeholder="Verifier Organization ID" 
                  value={shareVerifier} 
                  onChange={e => setShareVerifier(e.target.value)} 
                />
              </label>
              <button 
                className="primary" 
                onClick={() => void action.run(generateShareQr, "Created temporary QR")}
                disabled={action.busy}
              >
                Generate QR
              </button>
              {action.feedback}
            </div>
          ) : (
            <div style={{ textAlign: "center" }}>
               <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                  <QRCodeSVG 
                    value={shareQr.qr_payload} 
                    size={250} 
                    level="H" 
                    includeMargin={true}
                    fgColor="#0f172a"
                  />
               </div>
               <p style={{ marginTop: "1rem" }}>
                 <strong>Expires at:</strong> {new Date(shareQr.expires_at).toLocaleString()}
               </p>
               <button className="secondary" onClick={() => setShareQr(null)}>Create Another</button>
            </div>
          )}
        </Modal>
      )}
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
