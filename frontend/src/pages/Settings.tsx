import { useState, useEffect } from "react";
import { api } from "../services/api";
import { useSession } from "../services/session";
import {
  PageHead,
  Field,
  Form,
  useAction,
  Modal,
} from "../components/common/UI";

function OwnerVault() {
  const [vault, setVault] = useState("");
  useEffect(() => {
    api("/vault/me", "GET").then((res) => {
      if (res.success && res.data) setVault(res.data.vault_id);
    });
  }, []);

  if (!vault) return null;
  return (
    <section className="card">
      <h2>Vault identity</h2>
      <Field label="Vault ID">
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input readOnly value={vault} style={{ flex: 1 }} />
          <button
            type="button"
            className="secondary"
            onClick={() => navigator.clipboard.writeText(vault)}
          >
            Copy
          </button>
        </div>
      </Field>
      <p className="notice" style={{ marginTop: "1rem" }}>
        Share your Vault QR only with trusted issuers and verifiers.
      </p>
    </section>
  );
}

export default function Settings() {
  const { user, restore } = useSession(),
    [name, setName] = useState(user!.name),
    [zone, setZone] = useState(user!.timezone),
    [notifications, setNotifications] = useState(user!.notifications),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(false),
    action = useAction();
  const dirty =
    name !== user!.name ||
    zone !== user!.timezone ||
    notifications !== user!.notifications;
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return (
    <>
      <PageHead
        title="Settings"
        description="Manage your profile, local display preferences and account security."
      />
      {action.feedback}
      <div className="columns">
        <section className="card">
          <h2>Profile and preferences</h2>
          <Form
            onSubmit={() =>
              void action.run(async () => {
                await api("/users/me", "PUT", {
                  name,
                  timezone: zone,
                  notifications,
                });
                await restore();
              }, "Profile saved")
            }
          >
            <Field label="Display name">
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <input readOnly value={user!.email} />
            </Field>
            <Field label="Timezone">
              <select value={zone} onChange={(e) => setZone(e.target.value)}>
                {[
                  ...new Set([
                    "Asia/Kolkata",
                    "UTC",
                    "Europe/London",
                    "America/New_York",
                    "Asia/Singapore",
                    user!.timezone,
                  ]),
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
              Receive new in-app notifications
            </label>
            <small>
              Requests and audit records are retained even when notifications
              are disabled.
            </small>
            {dirty && <p className="notice">You have unsaved changes.</p>}
            <div className="actions">
              <button className="primary" disabled={action.busy || !dirty}>
                Save changes
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!dirty}
                onClick={() => {
                  setName(user!.name);
                  setZone(user!.timezone);
                  setNotifications(user!.notifications);
                }}
              >
                Cancel changes
              </button>
            </div>
          </Form>
        </section>
        <section className="card">
          <h2>Change password</h2>
          <p>All sessions are invalidated after a password change.</p>
          <Form onSubmit={() => setConfirm(true)}>
            <Field label="Current password">
              <input
                required
                type="password"
                value={current}
                autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field label="New password">
              <input
                required
                type="password"
                minLength={1}
                maxLength={128}
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <button className="primary" disabled={action.busy}>
              Change password
            </button>
          </Form>
        </section>
        {user!.role === "OWNER" && <OwnerVault />}
      </div>
      {confirm && (
        <Modal
          title="Change password and sign out"
          onClose={() => setConfirm(false)}
        >
          <p>
            Save your new password securely. You will need it to sign in again.
          </p>
          {action.feedback}
          <button
            className="primary"
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                await api("/auth/change-password", "POST", {
                  current_password: current,
                  password,
                });
                await restore();
              }, "Password changed")
            }
          >
            Confirm password change
          </button>
        </Modal>
      )}
    </>
  );
}
