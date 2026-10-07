import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { api } from "../../services/api";
import { useSession } from "../../services/session";
import { Field, Form, useAction, ErrorBox } from "../../components/common/UI";
export default function Login({
  mode = "login",
}: {
  mode?: "login" | "register" | "forgot" | "reset";
}) {
  const { user, restore, error } = useSession(),
    navigate = useNavigate(),
    location = useLocation(),
    [params] = useSearchParams();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [organization, setOrganization] = useState("");
  const role = ["ISSUER", "VERIFIER"].includes(params.get("role") || "")
    ? params.get("role")!
    : "OWNER";
  const action = useAction();
  const title = {
    login: "Sign in to CredVault",
    register: "Create your account",
    forgot: "Reset your password",
    reset: "Choose a new password",
  }[mode];
  if (user && mode === "login")
    return (
      <Navigate to={"/" + user.role.toLowerCase() + "/dashboard"} replace />
    );
  async function submit() {
    await action.run(
      async () => {
        if (mode === "login") {
          await api("/auth/login", "POST", { email, password });
          const u = await restore();
          if (!u) throw new Error("Could not restore your session.");
          const from = location.state?.from;
          const allowed =
            typeof from === "string" &&
            (from.startsWith("/" + u.role.toLowerCase() + "/") ||
              ["/settings", "/help", "/audit"].includes(from));
          navigate(allowed ? from : "/" + u.role.toLowerCase() + "/dashboard", {
            replace: true,
          });
        } else if (mode === "register") {
          if (role === "OWNER") {
            await api("/auth/register", "POST", { name, email, password });
            navigate("/login", { state: { created: true } });
          } else {
            const result = await api<{ message: string }>(
              "/auth/register-organization",
              "POST",
              { name, email, password, role, organization },
            );
            navigate("/login", { state: { approvalMessage: result.message } });
          }
        } else if (mode === "forgot") {
          const r = await api<{ message: string }>(
            "/auth/forgot-password",
            "POST",
            { email },
          );
          return r;
        } else {
          await api("/auth/reset-password", "POST", {
            token: params.get("token") || "",
            password,
          });
          navigate("/login", { state: { reset: true } });
        }
      },
      mode === "forgot"
        ? "If your account exists, a link is in the local development mail sink. No email was sent."
        : "Saved.",
    );
  }
  return (
    <main className="auth-page">
      <section className="auth-intro">
        <div className="brand">
          <ShieldCheck size={32} />
          <strong>CredVault</strong>
        </div>
        <h1>
          Your credentials.
          <br />
          Your consent.
        </h1>
        <p>
          A private workspace for issuer-signed credentials and field-level
          sharing.
        </p>
        <ul>
          <li>Encrypted document storage</li>
          <li>Registered issuer signatures</li>
          <li>Consent and access history</li>
        </ul>
        <small>Local development · Fictional demonstration data</small>
      </section>
      <section className="auth-form">
        <h2>{title}</h2>
        <p className="muted">
          {mode === "login"
            ? "Sign in to access your CredVault account."
            : mode === "register" && role === "OWNER"
              ? "Receive credentials and control which fields you share."
              : "Issuer and verifier organisations require administrator approval before portal access."}
        </p>
        <ErrorBox message={error} />
        {location.state?.created && (
          <p className="success">Account created. You can sign in.</p>
        )}
        {location.state?.approvalMessage && (
          <p className="notice" role="status">
            {location.state.approvalMessage}
          </p>
        )}
        {location.state?.reset && (
          <p className="success">
            Password reset. Sign in with your new password.
          </p>
        )}
        <Form onSubmit={() => void submit()}>
          {mode === "register" && (
            <>
              <Field label="Account role">
                <select
                  value={role}
                  onChange={(e) =>
                    navigate("/register?role=" + e.target.value, {
                      replace: true,
                    })
                  }
                >
                  <option value="OWNER">
                    Owner — receive and share credentials
                  </option>
                  <option value="ISSUER">
                    Issuer — organisation issuing credentials
                  </option>
                  <option value="VERIFIER">
                    Verifier — organisation requesting verification
                  </option>
                </select>
              </Field>
              {role !== "OWNER" && (
                <Field
                  label="Organisation name"
                  hint="Company, hospital, university, government agency or another organisation."
                >
                  <input
                    required
                    minLength={3}
                    maxLength={160}
                    autoComplete="organization"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </Field>
              )}
            </>
          )}
          {mode === "register" && (
            <Field label="Full name">
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </Field>
          )}
          {mode !== "reset" && (
            <Field label="Email">
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </Field>
          )}
          {mode !== "forgot" && (
            <Field label="Password">
              <input
                required
                type="password"
                minLength={1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Field>
          )}
          {action.feedback}
          <button disabled={action.busy} className="primary full">
            {action.busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Create reset link"
                    : "Save password"}
          </button>
        </Form>
        <div className="auth-links">
          {mode === "login" ? (
            <>
              <Link to="/forgot">Forgot password?</Link>
              <Link to="/register">Create account</Link>
            </>
          ) : (
            <Link to="/login">Back to sign in</Link>
          )}
        </div>
      </section>
    </main>
  );
}
