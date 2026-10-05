import { setData } from '../services/localStorageService';

export type DocumentCategory = 'Government' | 'Education';

export interface CredentialDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  type: string;
  issuer: string;
  issuedDate: string;
  expiryDate?: string;
  status: 'Verified' | 'Pending' | 'Action Required' | 'Active' | 'Revoked' | 'Expired';
  verified: boolean;
  icon: string;
  fields: Record<string, string>;
}

export interface ConsentRequest {
  id: string;
  verifierName: string;
  verifierLogo?: string;
  documentId: string;
  requestedFields: string[];
  purpose: string;
  status: 'Pending' | 'Approved' | 'Denied';
  requestDate: string;
}

export interface AuditLogEntry {
  id: string;
  action: 'Shared' | 'Denied' | 'Viewed';
  documentId: string;
  verifier: string;
  fieldsRequested: string[];
  fieldsShared: string[];
  decision: 'Approved' | 'Denied' | 'Auto-Approved';
  method: 'Manual Approval' | 'Rule-Based' | 'User Denied';
  timestamp: string;
}

export const mockDocuments: CredentialDocument[] = [
  {
    id: 'DOC-001',
    name: 'Aadhaar-style Identity',
    category: 'Government',
    type: 'National Identity',
    issuer: 'Govt. Identity Authority — Demo',
    issuedDate: '2023-05-12',
    status: 'Verified',
    verified: true,
    icon: 'Building2',
    fields: {
      name: 'Ayush Das',
      dob: '15/04/2003',
      gender: 'Male',
      idNumber: 'XXXX-XXXX-8921',
      address: '123 Secure Lane, Tech Park',
    },
  },
  {
    id: 'DOC-002',
    name: 'PAN-style Document',
    category: 'Government',
    type: 'Tax Identity',
    issuer: 'Income Tax Department — Demo',
    issuedDate: '2015-09-10',
    status: 'Verified',
    verified: true,
    icon: 'Building2',
    fields: {
      name: 'Ayush Das',
      accountNumber: 'ABCDE1234F',
      dob: '15/04/2003',
    },
  },
  {
    id: 'DOC-003',
    name: 'Passport',
    category: 'Government',
    type: 'Travel Document',
    issuer: 'Ministry of External Affairs — Demo',
    issuedDate: '2020-02-15',
    expiryDate: '2030-02-14',
    status: 'Verified',
    verified: true,
    icon: 'Building2',
    fields: {
      name: 'Ayush Das',
      nationality: 'Indian',
      dob: '15/04/2003',
      passportNumber: 'Z9876543',
      expiryDate: '2030-02-14',
    },
  },
  {
    id: 'DOC-004',
    name: 'Driving Licence',
    category: 'Government',
    type: 'Transport Document',
    issuer: 'Regional Transport Office — Demo',
    issuedDate: '2019-11-05',
    expiryDate: '2039-11-04',
    status: 'Verified',
    verified: true,
    icon: 'CarFront',
    fields: {
      name: 'Ayush Das',
      licenceNumber: 'DL-14-2019-883920',
      vehicleClass: 'MCWG, LMV',
      validity: '2039-11-04',
    },
  },
  {
    id: 'DOC-005',
    name: 'B.Tech Degree Certificate',
    category: 'Education',
    type: 'Degree Certificate',
    issuer: 'National Institute of Technology — Demo',
    issuedDate: '2017-06-30',
    status: 'Verified',
    verified: true,
    icon: 'GraduationCap',
    fields: {
      studentName: 'Ayush Das',
      degree: 'B.Tech Computer Science',
      graduationYear: '2017',
      cgpa: '8.9/10',
      universityId: 'CS-2013-405',
    },
  },
  {
    id: 'DOC-006',
    name: 'Marksheet',
    category: 'Education',
    type: 'Academic Transcript',
    issuer: 'National Institute of Technology — Demo',
    issuedDate: '2017-06-15',
    status: 'Verified',
    verified: true,
    icon: 'GraduationCap',
    fields: {
      studentName: 'Ayush Das',
      rollNumber: 'CS-2013-405',
      overallGrade: 'A',
    },
  },
];

export const mockConsentRequests: ConsentRequest[] = [
  {
    id: 'req-1',
    verifierName: 'FinTrust Bank',
    documentId: 'DOC-001',
    requestedFields: ['name', 'idNumber'],
    purpose: 'KYC Verification for new savings account',
    status: 'Pending',
    requestDate: '2026-10-05T09:30:00Z',
  },
  {
    id: 'req-2',
    verifierName: 'ABC Technologies',
    documentId: 'DOC-005',
    requestedFields: ['degree', 'cgpa'],
    purpose: 'Background Check & Employment Verification',
    status: 'Pending',
    requestDate: '2026-10-04T14:15:00Z',
  },
  {
    id: 'req-3',
    verifierName: 'City Traffic Police',
    documentId: 'DOC-004',
    requestedFields: ['name', 'licenceNumber', 'vehicleClass'],
    purpose: 'Traffic Stop Verification',
    status: 'Approved',
    requestDate: '2026-09-28T16:20:00Z',
  },
  {
    id: 'req-4',
    verifierName: 'Suspicious Corp',
    documentId: 'DOC-003',
    requestedFields: ['passportNumber', 'dob'],
    purpose: 'Marketing Database',
    status: 'Denied',
    requestDate: '2026-09-10T11:00:00Z',
  }
];

export const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'log-1',
    action: 'Shared',
    documentId: 'DOC-005',
    verifier: 'ABC Technologies',
    fieldsRequested: ['degree', 'universityId'],
    fieldsShared: ['degree', 'universityId'],
    decision: 'Approved',
    method: 'Manual Approval',
    timestamp: '2026-10-01T08:45:00Z',
  },
  {
    id: 'log-2',
    action: 'Denied',
    documentId: 'DOC-002',
    verifier: 'Bank Demo',
    fieldsRequested: ['accountNumber'],
    fieldsShared: [],
    decision: 'Denied',
    method: 'User Denied',
    timestamp: '2026-09-28T16:20:00Z',
  },
];

export const initializeDemoData = () => {
  if (!localStorage.getItem('credvault_documents')) {
    setData('documents', mockDocuments);
  }
  if (!localStorage.getItem('credvault_requests')) {
    setData('requests', mockConsentRequests);
  }
  if (!localStorage.getItem('credvault_audit_logs')) {
    setData('audit_logs', mockAuditLogs);
  }
  const defaultRules = [
    { id: '1', verifier: 'ABC Technologies', documentName: 'B.Tech Degree Certificate', documentId: 'DOC-005', field: 'degree', rule: 'Auto-Approve', lastUpdated: '2026-10-01T10:00:00Z' },
    { id: '2', verifier: 'ABC Technologies', documentName: 'B.Tech Degree Certificate', documentId: 'DOC-005', field: 'universityId', rule: 'Auto-Approve', lastUpdated: '2026-10-01T10:00:00Z' },
    { id: '3', verifier: 'ABC Technologies', documentName: 'B.Tech Degree Certificate', documentId: 'DOC-005', field: 'cgpa', rule: 'Ask Me', lastUpdated: '2026-10-01T10:05:00Z' },
    { id: '4', verifier: 'ABC Technologies', documentName: 'B.Tech Degree Certificate', documentId: 'DOC-005', field: 'rollNumber', rule: 'Deny', lastUpdated: '2026-10-01T10:05:00Z' }
  ];
  if (!localStorage.getItem('credvault_consent_rules')) {
    setData('consent_rules', defaultRules);
  }
};

