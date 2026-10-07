import { PageHead } from "../components/common/UI";
export default function Help() {
  return (
    <>
      <PageHead
        title="Help"
        description="Understand the roles, protections and classroom demonstration."
      />
      <div className="columns">
        <section className="card">
          <h2>Three connected roles</h2>
          <p>
            <strong>Issuer:</strong> an approved organisation signs immutable
            claims, delivers them to an owner and may revoke or replace them.
          </p>
          <p>
            <strong>Owner:</strong> stores credentials, shares an exact vault
            reference, configures consent and decides pending fields.
          </p>
          <p>
            <strong>Verifier:</strong> an approved organisation requests
            specific fields for a stated purpose and receives only approved
            values.
          </p>
          <h2>Consent modes</h2>
          <p>
            <strong>Auto-approve</strong> grants the matching field.{" "}
            <strong>Ask me</strong> waits for your explicit decision.{" "}
            <strong>Deny</strong> blocks a field and wins over other rules.
          </p>
          <p>
            Document rules take priority over type rules, then all credentials.
            Within those scopes, an exact verifier and then an exact field are
            more specific. Equal conflicting rules ask you. Disabled and expired
            rules are ignored.
          </p>
          <p>
            Any pending field holds the whole result. Final results include only
            approved fields and are labelled partially approved when others were
            denied. Rules are checked again before access; a new denial blocks
            future access. Previously downloaded data cannot be recalled.
          </p>
          <h2>Credential statuses</h2>
          <p>
            Valid means an approved issuer and active trust policy. Unverified
            means a personal upload with no issuer attestation. Expired,
            revoked, superseded or untrusted credentials cannot produce new
            disclosures. A signature proves who signed a claim; it does not
            independently prove its truth.
          </p>
        </section>
        <section className="card">
          <h2>Presentation walkthrough</h2>
          <ol>
            <li>
              Sign in as the demo issuer. Issue an education credential to Owner
              A's exact vault ID.
            </li>
            <li>Sign in as Owner A and inspect the signed values and dates.</li>
            <li>
              Create four rules for ABC Technologies: degree and university ID
              Auto-approve, CGPA Ask me, roll number Deny.
            </li>
            <li>
              Sign in as Verifier A. Request all four fields with a purpose.
            </li>
            <li>Return to Owner A and approve the pending CGPA field.</li>
            <li>
              Open the verifier result. It contains exactly three values and
              their claim proofs. The browser validates the signatures.
            </li>
            <li>
              Inspect the audit and notifications. Repeat with denial and
              automatic approval.
            </li>
            <li>
              Revoke the credential as issuer; result access must stop. Try the
              second owner and verifier to check isolation.
            </li>
            <li>
              Change a profile setting, refresh, restart the backend and check
              persistence. Log out and test private URLs.
            </li>
          </ol>
          <h2>Honest protection boundaries</h2>
          <p>
            AES-256-GCM protects data at rest. The server can decrypt it; this
            is server-enforced selective disclosure, not end-to-end encryption
            or a zero-knowledge proof.
          </p>
          <p>
            Age verification uses an issuer-signed threshold and assessment
            date, expiring within a year. It never requires disclosing a birth
            date.
          </p>
          <p>
            Audit entries are append-only through the application and database
            triggers. A database administrator able to rewrite the entire
            database and trust anchors can defeat the chain.
          </p>
          <p>
            Local HTTP is development-only. The repository includes a TLS 1.3
            reverse-proxy configuration for HTTPS deployments.
          </p>
          <h2>Local account assistance</h2>
          <p>
            Passwords for explicitly seeded demonstration accounts are in the
            private backend/demo.credentials.json file. Reset links are written
            to backend/mailbox; no external email service is used.
          </p>
        </section>
      </div>
    </>
  );
}
