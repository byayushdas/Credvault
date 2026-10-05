import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import MyDocuments from './pages/owner/MyDocuments';
import ConsentRequests from './pages/owner/ConsentRequests';
import AuditLog from './pages/owner/AuditLog';
import DocumentDetails from './pages/owner/DocumentDetails';
import ConsentRules from './pages/owner/ConsentRules';
import Login from './pages/auth/Login';
import IssuerDashboard from './pages/issuer/IssuerDashboard';
import IssueDocument from './pages/issuer/IssueDocument';
import IssuerRegistry from './pages/issuer/IssuerRegistry';
import VerifierDashboard from './pages/verifier/VerifierDashboard';
import NewVerification from './pages/verifier/NewVerification';
import VerifierResult from './pages/verifier/VerifierResult';
import VerifierHistory from './pages/verifier/VerifierHistory';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<Layout />}>
          {/* Default redirect to Owner Dashboard for demo purposes */}
          <Route index element={<Navigate to="/owner/dashboard" replace />} />
          
          {/* Owner Routes */}
          <Route path="owner/dashboard" element={<OwnerDashboard />} />
          <Route path="owner/documents" element={<MyDocuments />} />
          <Route path="owner/documents/:id" element={<DocumentDetails />} />
          <Route path="owner/requests" element={<ConsentRequests />} />
          <Route path="owner/consent" element={<ConsentRules />} />
          <Route path="audit" element={<AuditLog />} />
          
          {/* Issuer Routes */}
          <Route path="issuer/dashboard" element={<IssuerDashboard />} />
          <Route path="issuer/issue" element={<IssueDocument />} />
          <Route path="issuer/registry" element={<IssuerRegistry />} />

          {/* Verifier Routes */}
          <Route path="verifier/dashboard" element={<VerifierDashboard />} />
          <Route path="verifier/new" element={<NewVerification />} />
          <Route path="verifier/history" element={<VerifierHistory />} />
          <Route path="verifier/results/:id" element={<VerifierResult />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
