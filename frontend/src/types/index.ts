export type UserRole = "owner" | "issuer" | "verifier";

export type DocumentCategory = "government" | "education";

export type DocumentStatus = "verified" | "pending" | "revoked";

export type ConsentAction = "AUTO_APPROVE" | "ASK" | "DENY";

export type VerificationStatus = "PENDING" | "APPROVED" | "DENIED";

export interface Document {
  id: string;
  name: string;
  category: DocumentCategory | string;
  type: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: DocumentStatus | string;
  verified: boolean;
  fields: Record<string, string>;
}

export interface ConsentRule {
  id: string;
  verifierId?: string;
  verifierName?: string;
  verifier: string; // Keep for backwards compatibility with current mock
  documentId: string;
  documentName: string;
  field: string;
  rule?: string; // Keep for backwards compatibility
  action: ConsentAction | string;
  lastUpdated?: string;
}

export interface VerificationRequest {
  id: string;
  verifierId?: string;
  verifierName: string;
  ownerId?: string;
  documentId: string;
  requestedFields: string[];
  status: VerificationStatus | string;
  createdAt?: string;
  requestDate?: string; // Backwards compatibility
  purpose?: string;
}

export interface AuditLogEntry {
  id: string;
  action: 'Shared' | 'Denied' | 'Viewed' | string;
  documentId: string;
  verifier: string;
  fieldsRequested?: string[];
  fieldsShared: string[];
  decision?: 'Approved' | 'Denied' | 'Auto-Approved' | string;
  method?: 'Manual Approval' | 'Rule-Based' | 'User Denied' | string;
  timestamp: string;
}
