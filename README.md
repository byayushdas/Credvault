# CredVault

CredVault connects approved issuers, document owners and approved verifiers. It uses real authentication, PostgreSQL persistence, AES-256-GCM encrypted storage, Ed25519 claim signatures, field-level consent and an append-only access trail. There is no blockchain, wallet, paid service or external email requirement.

## Connected issuer and verifier portals

Owners can **Copy Vault ID** from their dashboard. Issuers confirm that exact recipient during review; verifiers confirm it at step one. Confirmation returns only the reference and availability, never a private profile or vault inventory.

Choose **Semester Marksheet** to issue course, semester, CGPA and roll number. This uses the additive `SEMESTER_MARKSHEET` schema; existing percentage-based `MARKSHEET` credentials retain their signed fields and remain supported. The issuer dashboard includes issued, valid, expired and revoked totals. Verification history has inclusive UTC submission-date filters. Owner credential details link to associated requests.

Authenticated SSE at `/api/v1/events` connects all portals. Per-user revision cursors are written in the same database transaction as audit-producing changes; rolled-back changes cannot publish a revision. The stream observes committed cursors once per second and sends only a revision number. It checks the session and current membership on every iteration, refuses cross-origin requests, and never accepts a user/organisation selector. Notification reads also advance the user's cursor. No claim values, document references or private profile data are broadcast.

Clients refetch their authorized data on changes and every reconnect, including events missed offline. Subscriptions close on logout/account changes, and invalidated sessions terminate existing streams. The footer displays connection state. A 15-second visible-tab polling fallback runs only while SSE is disconnected; focus also restores state. SSE uses short independent database reads and never holds the application's transaction lock for the lifetime of a connection. This implementation is intended for the documented local classroom workload.

For the connected demo, keep Owner A's documents open while issuing a Semester Marksheet, then keep the owner's requests and verifier's history open in separate browser sessions. Set course/semester to Auto-approve, CGPA to Ask me, and roll number to Deny. Request all four, approve CGPA, and observe the verifier receive precisely course, semester and CGPA without reloading. Disconnect/reconnect the verifier and revoke the credential to demonstrate resynchronization and blocked future access.

## Start locally

Prerequisites: Node.js 22.19+ and Python 3.12. Use PowerShell or a Linux/macOS terminal from this repository. The npm lockfiles are authoritative.

```text
npm ci
npm --prefix frontend ci
npm run setup
```

`setup` creates `.venv` and `backend/.env` only when missing; existing secrets are preserved. On Windows it uses `py`; on Linux/macOS it uses `python3`. If necessary set `CREDVAULT_PYTHON` to your Python executable before setup. For this Codex machine, the existing `.venv` is already configured.

Keep one terminal running:

```text
npm run db
```

In another terminal:

```text
npm run migrate
npm run seed
npm run dev
```

Open **http://localhost:5173**. Use `localhost`, matching `APP_ORIGIN`, for browser mutations. The API binds to loopback port 8000; PostgreSQL uses loopback port 55432. `/health` checks the real database. Ctrl+C stops each foreground command; data remains in `.local/postgres`. Never delete this directory to fix a startup problem.

The optional bundled PostgreSQL runner uses actual PostgreSQL binaries, not an in-memory substitute. On Linux run it as an ordinary user. First installation needs internet to download dependencies. It does not install an OS service or alter system accounts. Secrets in `.local/database.json`, `backend/.env` and credential files are ignored by Git. Preserve them with your backups.

### Development accounts

Run `npm run seed` explicitly. It refuses production mode, creates fictional records idempotently, and never resets existing passwords or data. Read **backend/demo.credentials.json** locally for the generated password; it is not hard-coded in source or the UI.

| Role                                | Email                |
| ----------------------------------- | -------------------- |
| Owner A, Asha Demo                  | owner.a@demo.test    |
| Owner B, Rohan Demo                 | owner.b@demo.test    |
| Issuer, Demo Academic Institute     | issuer@demo.test     |
| Verifier A, ABC Technologies (Demo) | verifier.a@demo.test |
| Verifier B, XYZ Verification (Demo) | verifier.b@demo.test |

Owner IDs are UUIDs shown on each owner's dashboard. Share the exact ID with an issuer/verifier. The login page offers one **Create account** link. Choose **Owner**, **Issuer**, or **Verifier** on the signup page. Owner signup is immediately available. Issuer/verifier signup creates that role and a pending organisation; it cannot issue credentials or request private data until a local administrator approves it. A role selection never grants trusted access by itself. Use separate emails for separate role accounts; existing accounts and vaults are not silently converted.

After organisation signup, approve the exact email from `backend` (PowerShell):

```powershell
..\.venv\Scripts\python.exe -m scripts.admin approve --email registrar@example.org --role ISSUER --organization "Your institution"
..\.venv\Scripts\python.exe -m scripts.admin approve --email reviewer@example.org --role VERIFIER --organization "Your organisation"
```

This approves the existing pending organisation and provisions an issuer signing key when needed. Users then sign in on the common login page and are sent to their authorised portal. The fictional seeded issuer/verifier accounts above are already approved.

### Docker or an existing PostgreSQL server

Docker is optional. Set a private `POSTGRES_PASSWORD` environment variable, then run `docker compose up -d`. Update `backend/.env` to use `postgresql+psycopg://credvault:YOUR_PASSWORD@127.0.0.1:5432/credvault`. Run migrations using a database owner/migration login. Apply `deploy/roles.sql`, set the runtime login's password privately with psql `\password`, and set `DATABASE_URL` to that runtime login. Keep the owner URL as `MIGRATION_DATABASE_URL` only in your local/admin environment.

The bundled setup configures a distinct `credvault_runtime` login automatically after `npm run migrate`. It has no table ownership or schema-creation rights. Audit access is SELECT/INSERT only; UPDATE/DELETE/TRUNCATE is denied independently of application code. Triggers also reject those operations. For externally managed PostgreSQL, apply equivalent permissions after every migration. Do not use a superuser for the API.

## Demonstration

1. Sign in as the issuer. Enter Owner A's vault ID, choose Education credential, and fill degree, university ID, CGPA and roll number. Save/edit a draft, review and issue.
2. Sign in as Owner A. Open the delivered credential and check its values, dates, issuer and valid signature.
3. Under Consent Rules, select ABC Technologies and that exact credential. Set degree and universityId to Auto-approve, cgpa to Ask me, and rollNumber to Deny.
4. Sign in as Verifier A. Complete the four-step wizard with Owner A's reference, choose the issued credential, select all four fields, state a purpose and submit.
5. Owner A sees a notification and pending request. Approve cgpa and confirm the field decisions.
6. Verifier A opens View result. Exactly degree, universityId and cgpa are returned. The browser checks each Ed25519 proof against the public issuer registry. JSON/download contains no roll number or unrelated private fields.
7. Inspect owner audit events, verifier history, counts and notifications. Try a CGPA-only request with manual denial, and a degree-only request for automatic approval.
8. Try Owner B and Verifier B: the credential/request is unavailable, including through direct API calls. Revoke the credential as issuer and confirm further result access is blocked.
9. Import a personal image/PDF; it stays Unverified. Request only over18 from the fictional age credential; no birth date is stored or returned.
10. Change a profile preference, reload, restart `npm run dev`, and check it persists. Log out; private routes, another tab, downloads and API calls are blocked.

Help inside the application repeats this workflow. The seed also includes a marksheet and pending, approved, denied, partial, expired, cancelled and revoked examples.

## Architecture and repair

The original React app used mock data/localStorage, read-only login fields, frontend role switching, inert settings/help controls and an issuance button that only displayed success. The backend was a disconnected FastAPI/SQLAlchemy/SQLite prototype with non-revocable bearer login, role self-registration, a whole-request deny decision and signatures that did not bind selected claim values.

The existing React/Vite/npm and FastAPI/SQLAlchemy/Alembic stack is retained. It now uses PostgreSQL through psycopg, a same-origin Vite proxy, revocable HttpOnly cookie sessions, Argon2 password hashing, CSRF tokens and origin checks. The API is divided into auth, documents/issuance, verification/consent, workspace/settings and registry/OAuth modules. The React shell restores a server session; role guards are complemented by role, organisation and object checks on every private API/file operation. No private browser database or long-lived token is kept in localStorage.

`cv_` tables cover users, memberships, organisations, sessions, resets, issuer keys, encrypted credentials/drafts, consent rules, requests, field decisions/history, notifications, OAuth clients/tokens and audit events. The original prototype migration and tables are preserved. Additive migrations introduce the connected model and versioned proof context. Prototype records are not silently promoted to trusted signed credentials; if you have data from an older installation, keep that database/key backup and arrange deliberate validation/re-issuance. No original database was present in the supplied workspace.

All related mutations and required audit records use transactions. A PostgreSQL advisory transaction lock per database schema establishes a total order for this local workload, preventing concurrent consent/revocation/disclosure races and hash-chain forks. Issuance and verifier submission use idempotency keys with payload fingerprints. Owner decisions and consent-rule edits/deletes use revision checks. Stale rule mutations return HTTP 409 without overwriting current consent. A disclosure audit event is committed **before** any sensitive result is returned. Failed writes/transactions cannot create a falsely successful issuance; newly written encrypted files are cleaned up on rollback.

### Consent and freshness

- Reject unapproved verifier membership before accessing claims.
- Match enabled, unexpired rules to owner, verifier, credential/type and field.
- Any applicable Deny wins. Otherwise compare scope lexicographically: exact credential > type > all credentials; exact verifier > all verifiers; exact field > all fields.
- Conflicting equal-specificity rules and no matching rule resolve to Ask me.
- Requests remain Pending while any field needs a decision. Final states are Approved, Partially approved or Denied; expired and cancelled requests cannot disclose.
- Re-evaluate before request display/decisions/result access. Tightening a rule invalidates broader automatic grants. Manual approvals survive Ask me, but an applicable Deny always blocks them. A finalized denied field never silently becomes approved; submit a new request for renewed consent.
- Persist decision method, rule ID/version snapshots and append decision history. Check credential expiry/revocation, registry trust and client/membership authorization again before every disclosure. Results are not cached by the server or browser HTTP cache. SSE triggers authorized refetches; focus and disconnected-stream polling provide recovery.

Dashboard document counts exclude archived uploads; valid counts additionally require issuer/key trust and unexpired status. Pending counts use the same request statuses as the Pending filter and sidebar. Completed disclosures count actual successful result-access audit events, including repeat reads, rather than approvals.

### Encryption, signatures and key lifecycle

A random 256-bit master encryption key is generated once during setup. AES-256-GCM uses independent 96-bit nonces and record-specific associated data. Structured claims, their signatures, drafts, issuer private keys and attachment bytes are encrypted. Plaintext metadata is limited to necessary identifiers, titles/types, indexes, dates and operational consent/audit metadata. Do not put sensitive claim values in document titles or request purposes.

Ed25519 signing keys are separate random key material. The public registry holds key ID, organisation, validity and revocation metadata. A complete signed record binds issuer, owner, credential ID/version, claims, validity, attachment hash and replacement link. Each individually signed claim binds the same context plus its name and value. Version 2 proofs also bind signing time; age proofs bind assessment date. The API only releases selected claim payloads/signatures, never a hidden full-record payload. Canonical signed bytes are UTF-8 JSON, sorted keys, compact separators, no NaN/Infinity. Consumers verify the supplied signed bytes, compare the decoded context to the expected subject/credential/field/value, and obtain/pin the matching public key from a trusted registry. The browser performs both registry and signature checks.

Age is an issuer-attested threshold, assessed on/before issuance and valid for at most 365 days after assessment. This is **server-enforced selective disclosure**, not a cryptographic zero-knowledge proof or end-to-end encryption. Issuer signatures establish authorship, not the truth of an arbitrary personal upload. Signed package imports validate packages already issued in this registry to the same owner; unknown/cross-registry packages are rejected.

Keep the encryption key, database and encrypted storage backed up together with restrictive filesystem access. Never regenerate the key on startup. A wrong key fails closed. For encryption-key rotation, stop writes, make a verified backup, decrypt/re-encrypt every credential, draft, private key and attachment with the old/new keys and the original associated-data contexts, verify all records, then switch configuration atomically; no online rotation command is claimed. Signing-key rotation retires the old signing key for new issuance while preserving historical public keys. Explicit key revocation blocks future disclosure of all credentials signed by that key, including older credentials. A normal rotation does not invalidate earlier proofs.

The `EncryptedStore` interface in `backend/app/services/storage_service.py` is the storage boundary. The local implementation uses private files outside static folders. A cloud implementation must preserve authenticated encryption, opaque references, rollback deletion and authenticated API reads; never expose plaintext public object URLs.

### Audit boundary

Each event has a sequence/event ID, server UTC time, actor/organisation, owner/credential/request references, requested/shared field names, method/outcome and previous/current SHA-256 hashes. Values, passwords and tokens are excluded. `npm run audit:check` verifies the complete chain and prints its head; store trusted checkpoints outside the database for stronger tamper detection. Normal runtime users cannot modify existing events. An administrator who can rewrite the full database and all trusted checkpoints can defeat a hash chain; this is not absolute immutability. Revocation cannot erase information already downloaded.

### Local administration and OAuth2

From `backend`, use `../.venv/bin/python` on Linux/macOS or `..\\.venv\\Scripts\\python.exe` in PowerShell:

```text
python -m scripts.admin approve --email institution@example.org --role ISSUER --organization "Approved institution"
python -m scripts.admin approve --email verifier@example.org --role VERIFIER --organization "Approved verifier"
python -m scripts.admin client --email verifier.a@demo.test --output local.credentials.json
python -m scripts.admin rotate-key --email issuer@demo.test
python -m scripts.admin revoke-key --email issuer@demo.test --key-id KEY_UUID
python -m scripts.admin audit
```

Replace `python` in these commands with the virtual-environment executable. Register the account before approving membership. Client creation exclusively creates the named private output file and refuses to overwrite it. Protect and keep it out of browser code. Authlib implements RFC6749 client credentials at `POST /api/v1/oauth/token`: HTTP Basic client ID/secret, form `grant_type=client_credentials`, optional space-separated `scope`. Available scopes: `requests:read`, `requests:write`, `results:read`. Tokens last 600 seconds, are stored only as SHA-256 hashes, have no refresh token and are checked against client/org membership on each use. Revoking a client invalidates its existing tokens. API scopes never bypass owner consent. Browser cookies and API tokens are separate flows.

Password reset links go only to the private `backend/mailbox` development mail sink, expire after 30 minutes and work once. The public API gives no token. Newly created mail, demo-password and OAuth-secret files use exclusive creation and owner-only POSIX permissions; Windows deployments should retain the user's private workspace ACL. Password change/reset and logout revoke sessions; logout also clears client state and broadcasts to other tabs. Production reset email delivery must be configured; the local sink is disabled there.

## Checks and operating limits

```text
npm run lint
npm run build
npm test
npm run test:browser
npm run audit:check
```

Tests use isolated random PostgreSQL schemas and private test file directories. They never reset your application database. `npm test` needs the configured migration login to create/drop test schemas. Browser tests launch an isolated API/frontend, use separate authenticated browser contexts and stop/restart the real backend process. On this Windows machine they use installed Chrome; elsewhere install Chromium with `npx playwright install chromium` or set `CREDVAULT_BROWSER` to an installed executable. Restrictive sandboxes may require permission to start/stop child processes.

Results and screenshots are written to ignored `test-results/`. See `VERIFICATION.md` for the final executed checks and measured performance. The `.pdf` and screenshot references from the request were not available; the supplied written requirements were used.

The app is intended for a local classroom demonstration. List search/filter/sort/pagination runs over each authenticated user's permitted metadata; large deployments should add server-side cursor pagination. The single transaction lock and per-process rate limiter are explicit small-deployment choices; scaling needs a shared rate-limit store and more granular serialization. No cloud storage adapter, external identity proofing or outbound mail provider is claimed.

`deploy/Caddyfile` supplies an HTTPS reverse-proxy path restricted to TLS 1.3. Set `APP_ORIGIN=https://localhost:8443` and `SECURE_COOKIES=true`, build the frontend, and run Caddy using that file. Local HTTP is not TLS-protected. The Caddy/TLS and Docker paths were not exercised in this environment; native PostgreSQL and local HTTP were. No public deployment was performed.


# CredVault repair checklist

Inspected 6 October 2026. Existing stack: React 19 / TypeScript / Vite 8 / npm; FastAPI / SQLAlchemy / Alembic / Python. No applicable AGENTS.md, existing database, PDF or screenshot attachments found. Preserve the untracked `backend/package-lock.json`.

Observed gaps: frontend uses mock data/localStorage, login inputs are read-only, role switch grants UI access, issuance reports success without a request, settings/help are inert. Backend uses non-revocable bearer authentication, permits role registration, lacks field-bound proofs, treats a single denied field as whole-request denial, and has no durable notifications/reset flow. PostgreSQL and a normal Python installation are absent from PATH. Bundled Python 3.12 is available.

## Connected milestones / control inventory

- [x] A: reproduced startup/build and documented stack.
- [x] B: PostgreSQL migration, development setup, cookie sessions, CSRF, owner registration, login/reset/change/logout; authorized shell, account/settings/help, scoped search.
- [x] C: schema-based issue form, encrypted drafts, review/issue, optional attachment, immutable signed claims, registry, owner document list/filter/sort/page/view/preview/download/import/archive, issuer list/revoke/replace.
- [x] D: exact owner reference, four-step verification wizard/back/next/review/submit, request lists/details/cancel, field decisions/approve/deny, selected proofs/results/download, durable disclosure audit.
- [x] E: consent create/edit/disable/delete/filter/save/cancel, notifications/read/navigation, settings persistence, audit filter/detail/export, dashboard counts. Optimistic versions protect stale consent edits and deletes.
- [x] F: supplied palette, responsive drawer/tables/forms, focus/keyboard/error/loading/empty states; pagination stays valid after a list shrinks.
- [x] G: 40 isolated PostgreSQL tests, browser walkthrough at 1440/1024/768/390, production build/lint, restart persistence, measured timings and handoff in README.md and VERIFICATION.md.

Every retained action must have server authorization, validation, persistent mutation, refresh and failure feedback. No public deployment or real messages.

## Issuer/verifier connection follow-up

- [x] Add the course/semester/CGPA/roll-number Semester Marksheet schema without rewriting existing signed marksheets.
- [x] Confirm exact recipient availability, add Copy Vault ID, issuer expiry/revocation totals, request date filters and associated request links.
- [x] Add authenticated SSE with transactional user-scoped revision cursors, session/membership revalidation, logout cleanup, reconnect resynchronization and a documented polling fallback.
- [x] Exercise live issuance, request delivery, manual decision, selective result, disconnect/reconnect, revocation and isolated event subscriptions in separate authenticated browser contexts.
- [x] Scope the transaction lock to the database schema so isolated test fixtures do not block the live application or one another.

The final control inventory, executed evidence and explicitly unverified external paths are recorded in [VERIFICATION.md](VERIFICATION.md). Setup, architecture, policies and presentation steps are in [README.md](README.md). The original prototype migration and all generated development secrets remain intact; changes use additive migrations. Existing fictional age evidence was retained and superseded through normal linked issuance with the current proof format.


# CredVault verification record

Executed locally on 6 October 2026. The implementation remains in the supplied repository. No public deployment, paid infrastructure or real email/invitations were used. The referenced PDF and screenshots were unavailable; the written request supplied the requirements.

## Executed checks

Latest registration follow-up: login now exposes Owner, Issuer and Verifier signup. Organisation accounts persist as pending and cannot sign in or use private APIs until administrator approval. **9 targeted authentication/onboarding tests passed**, along with build and lint. `node scripts/browser-test.mjs --onboarding-only` passed both issuer and verifier registration → pending-login rejection → CLI approval → correct dashboard scenarios in isolated browser sessions. The 390px login layout was checked for overflow; screenshot and report are in `test-results/three-role-login.png` and `test-results/onboarding-report.json`. Existing accounts were not converted or reset. The full workflow results below are from the preceding portal regression run; the current follow-up reran the affected authentication flows.

| Check                                                  | Result                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                         | Passed, no findings                                                                                                                                                     |
| `npm run build`                                        | TypeScript and Vite production build passed; JavaScript 344.55 kB / 104.10 kB gzip                                                                                      |
| `npm test`                                             | **40 passed** in 203.19 seconds against real PostgreSQL                                                                                                                 |
| Password/reset regression after private-file hardening | **3 passed**                                                                                                                                                            |
| `npm run test:browser`                                 | **20 workflow groups passed** using installed Chrome and isolated API/frontend processes                                                                                |
| Browser errors                                         | No unhandled JavaScript errors or unexplained API 5xx responses                                                                                                         |
| Restart persistence                                    | Browser runner stopped the actual API process, confirmed health was offline, restarted it, and verified the saved profile                                               |
| Responsive inspection                                  | Populated dashboard and field-decision screenshots at 1440, 1024, 768 and 390 pixels; no document-level horizontal overflow; mobile drawer opens and closes with Escape |
| Runtime permissions                                    | Database role cannot create public-schema objects or update/delete/truncate audit records; appends remain allowed                                                       |
| Audit integrity                                        | Main demo chain valid, 22 events at the recorded check                                                                                                                  |
| Running app smoke check                                | All five demo accounts authenticated against the restarted localhost service; authorized dashboards, notifications, existing signatures and logout worked               |
| Source hygiene                                         | Python compilation and `git diff --check` passed; secrets/build/test output ignored by Git                                                                              |

One dependency warning remains: Starlette warns that its `httpx` TestClient integration is deprecated in favor of `httpx2`. Tests pass with the pinned dependencies. This is a test-library warning, not an application failure.

The original untracked `backend/package-lock.json` was preserved. No database reset or encryption-key regeneration occurred. The old demo age record was preserved and given a linked replacement through normal issuance, so the available example uses a proof that binds the assessment date.

## Live portal follow-up

The added browser acceptance scenario issues a Semester Marksheet through the issuer UI and observes it in the owner's already-open document list. Request delivery and owner decisions update the other authenticated sessions without reload. The browser verifies only course, semester and CGPA; roll number is absent. The verifier is disconnected, the issuer revokes the credential, and reconnect removes the cached result and blocks retrieval. Owner B and Verifier B receive no change events for this workflow, even when a subscription supplies another user's ID. Event payloads contain only revision numbers. Copy Vault ID, recipient confirmation and UTC date filters are also exercised.

Three added PostgreSQL tests cover commit/rollback visibility, live-recipient isolation, session/logout authorization, recipient validation, marksheet consent and issuer status totals. The first concurrent regression run exposed unrelated schemas sharing the same advisory lock (a 3,002 ms processing sample and a browser timeout). The lock now derives from the current database schema, preserving serialization within the application while separating test fixtures. The final measurements below include concurrent browser-test activity. During the deliberate backend restart, two expected proxy 502 responses were recorded; both were confined to the outage and clients recovered.

## Workflow and control coverage

| Area                      | Browser actions and backend evidence                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication            | Owner registration, failed login message, ordinary role login, forbidden role screen, session restoration, password change and mail-sink reset. API tests cover CSRF/origin failures, expired sessions/reset links, single-use tokens, role escalation rejection and all-session logout.                                                    |
| Shell and settings        | Account menu, Settings and Help navigation, scoped search with ArrowDown/Escape, notification navigation/read controls, display name/timezone/notification preference save and cancel, reload/restart persistence, responsive navigation.                                                                                                   |
| Issuance                  | Save/edit/delete encrypted draft, review/back, sign/issue, owner delivery and issuer/owner details. API tests cover attachments, actual MIME validation, encryption integrity and authorization.                                                                                                                                            |
| Documents                 | Search, category/status filters, sorting, previous/next pagination, view, signed export/import, unsigned import, authenticated preview/download and archive. Personal uploads stay unverified.                                                                                                                                              |
| Verification              | Four-step wizard, exact owner lookup, explicit credential selection, field/purpose validation, Back preservation, submit, history search/status filters, request detail, cancellation and result JSON/download.                                                                                                                             |
| Consent                   | Create/edit/disable/enable/delete rules, search, field approval and denial with confirmation. Regression tests reject stale edit/delete versions. The decision matrix includes no rule, automatic/ask/deny, conflicts, expired/disabled rules, partial approval, duplicate decisions and tightening consent after submission.               |
| Privacy and proofs        | Degree, university ID and CGPA are the only disclosed values in the mixed example. Roll number is absent from API bodies and the downloaded JSON. Browser WebCrypto independently verifies each Ed25519 claim. Tests reject modified values, transplanted subjects/credential IDs, tampered ciphertext, untrusted issuers and revoked keys. |
| Age example               | Only `over18` is disclosed, with issuer-signed assessment/validity context and no birth date.                                                                                                                                                                                                                                               |
| Isolation                 | Owner B and Verifier B cannot access Owner A's credential/request by URL or direct API. Search and file access are scoped.                                                                                                                                                                                                                  |
| Registry and OAuth        | Public key expansion, organisation name update, API-client revocation. Authlib client-credentials tests cover HTTP Basic, scopes, 600-second token lifetime, expiry and revocation.                                                                                                                                                         |
| Revocation and correction | Issuer reason/confirmation, blocked future disclosure, linked replacement version. Concurrent disclosure/revocation tests establish a consistent audit order.                                                                                                                                                                               |
| Audit and logout          | Audit search/type filter, details and metadata export; disclosure audit commits before response and an injected persistence failure blocks release. Logout clears private routes, browser Back, another tab and direct API/file access.                                                                                                     |

Local artifacts are in ignored `test-results/`: `browser-report.json`, `performance.json`, and `dashboard-{width}.png` / `request-{width}.png`. The browser test recreates these from live data; it does not use mocked responses. Test schemas have random names, are isolated from demo/user records, and are dropped by the runner after completion.

Browser testing found and led to repairs for stale consent-rule updates, stale route data, draft-edit state and form label associations. The final pagination helper also clamps the visible page when records are removed. Labels and status text accompany colors. Measured WCAG contrast ratios include body text 14.26:1, muted text on workspace 5.38:1, primary action 10.43:1, hover 15.39:1, selected navigation 9.73:1, status text at least 6.46:1, and focus outline on white 4.88:1. Disabled controls use native disabled semantics and a subdued style. This was a targeted accessibility check, not a full assistive-technology audit.

## Local processing measurements

Environment: Windows 11 build 26200, Node 22.19.0, npm 10.9.3, Python 3.12.14, PostgreSQL 18.4 x64 on loopback. FastAPI TestClient executes in-process while using real PostgreSQL transactions; browser/network rendering is outside this benchmark.

Dataset: five users, three organisations, six credentials, six initial requests, five consent rules, and 25 new one-field requests. Each request was automatically approved and then retrieved. Timing includes validation, consent processing, signature checks where applicable, database work and durable audit commits. Human approval waiting and large file transfers are excluded.

| Operation, 25 samples        |   Median | 95th percentile |   Maximum |
| ---------------------------- | -------: | --------------: | --------: |
| Automatic request evaluation | 94.43 ms |       706.94 ms | 931.94 ms |
| Result retrieval             | 72.27 ms |       402.22 ms | 413.01 ms |

Every measured sample was below the two-second local target. These results describe this small dataset and environment; they are not a production concurrency or throughput guarantee.

## Unverified paths and operating limits

- Native Windows PostgreSQL and local HTTP were exercised. Docker, Linux/macOS execution and the supplied Caddy TLS 1.3 configuration were not executed here. Local HTTP does not encrypt network traffic.
- Production outbound email, cloud object storage, external identity proofing and cross-registry credential import need separate configuration or implementation. Current signed imports validate records already issued in this registry to the same owner.
- A single transaction lock deliberately serializes this classroom workload. List pagination/filtering uses each authenticated user's permitted metadata in the browser; a large deployment needs server pagination, finer locking and a shared rate limiter.
- Encryption-key rotation is a documented offline procedure, not an automated rotation command. Retain the original key with backups. Signing-key rotation/revocation has an administrative command and a conservative revocation policy.
- This is server-enforced selective disclosure. It is not end-to-end encryption or a cryptographic zero-knowledge proof. The server can decrypt authorized content. Revocation blocks future retrieval but cannot erase previously downloaded information.
- The append-only role, triggers and hash chain protect against normal application writes. A database administrator capable of replacing the database and all trusted checkpoints is outside that integrity boundary.

See [README.md](README.md) for exact setup/migration/seed/startup/test commands, development-role sign-in details, architecture and the presentation walkthrough.


# Backend

See the repository [README](../README.md) for setup, migrations, seed accounts, security boundaries, OAuth2, testing and administration. Run the documented root commands so the persistent encryption key, runtime database role and virtual environment remain consistent.

API: FastAPI, SQLAlchemy, PostgreSQL/psycopg. Schemas: `app/models/records.py`. API contracts: `app/schemas/contracts.py`. Crypto, consent, storage and audit boundaries: `app/services`. Alembic migrations preserve prototype tables and introduce the connected `cv_` schema without destructive resets.


# Frontend

React 19, TypeScript and Vite with the existing npm lockfile. The authenticated React Router shell calls the FastAPI backend through a same-origin proxy; there is no mock/localStorage data source or frontend role override.

Use the root [README](../README.md) to start the complete application. For isolated frontend work: `npm run dev`, `npm run build`, `npm run lint` from this directory. The backend must run on loopback port 8000, and the browser origin must match APP_ORIGIN. Main UI contracts live in `src/services/api.ts`; authenticated session refresh and invalidation in `src/services/session.tsx`.
