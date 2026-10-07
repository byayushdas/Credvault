import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { SessionProvider, useSession } from "./services/session";
import Layout from "./components/Layout";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/owner/OwnerDashboard";
import MyDocuments from "./pages/owner/MyDocuments";
import DocumentDetails from "./pages/owner/DocumentDetails";
import Requests from "./pages/owner/ConsentRequests";
import ConsentRules from "./pages/owner/ConsentRules";
import AuditLog from "./pages/owner/AuditLog";
import IssueDocument from "./pages/issuer/IssueDocument";
import IssuerRegistry from "./pages/issuer/IssuerRegistry";
import NewVerification from "./pages/verifier/NewVerification";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import { Loading } from "./components/common/UI";
function Protected({ role }: { role?: string }) {
  const { user, loading } = useSession(),
    location = useLocation();
  if (loading) return <Loading />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role)
    return (
      <div className="card">
        <h1>Access restricted</h1>
        <p>Your account does not have this role.</p>
      </div>
    );
  return <Outlet />;
}
function Home() {
  const { user } = useSession();
  return (
    <Navigate to={"/" + user!.role.toLowerCase() + "/dashboard"} replace />
  );
}
export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login mode="register" />} />
          <Route path="/forgot" element={<Login mode="forgot" />} />
          <Route path="/reset" element={<Login mode="reset" />} />
          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route element={<Protected role="OWNER" />}>
                <Route path="/owner/dashboard" element={<Dashboard />} />
                <Route path="/owner/documents" element={<MyDocuments />} />
                <Route
                  path="/owner/documents/:id"
                  element={<DocumentDetails />}
                />
                <Route path="/owner/requests" element={<Requests />} />
                <Route path="/owner/requests/:id" element={<Requests />} />
                <Route path="/owner/consent" element={<ConsentRules />} />
              </Route>
              <Route element={<Protected role="ISSUER" />}>
                <Route path="/issuer/dashboard" element={<Dashboard />} />
                <Route path="/issuer/issue" element={<IssueDocument />} />
                <Route path="/issuer/documents" element={<MyDocuments />} />
                <Route
                  path="/issuer/documents/:id"
                  element={<DocumentDetails />}
                />
                <Route path="/issuer/registry" element={<IssuerRegistry />} />
              </Route>
              <Route element={<Protected role="VERIFIER" />}>
                <Route path="/verifier/dashboard" element={<Dashboard />} />
                <Route path="/verifier/new" element={<NewVerification />} />
                <Route path="/verifier/history" element={<Requests />} />
                <Route path="/verifier/requests/:id" element={<Requests />} />
                <Route path="/verifier/results/:id" element={<Requests />} />
                <Route
                  path="/verifier/organization"
                  element={<IssuerRegistry />}
                />
              </Route>
              <Route path="/audit" element={<AuditLog />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              <Route
                path="*"
                element={
                  <div className="card">
                    <h1>Page not found</h1>
                    <a href="/">Return to dashboard</a>
                  </div>
                }
              />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
