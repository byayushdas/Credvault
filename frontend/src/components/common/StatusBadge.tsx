import { CheckCircle2, Clock, X, ShieldCheck } from 'lucide-react';
import type { DocumentStatus, VerificationStatus } from '../../types';

interface StatusBadgeProps {
  status: DocumentStatus | VerificationStatus | string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'verified':
    case 'approved':
    case 'active':
      return (
        <span className="badge-success px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
          {normalizedStatus === 'verified' ? <ShieldCheck className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          {status}
        </span>
      );
    case 'pending':
      return (
        <span className="badge-pending px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </span>
      );
    case 'revoked':
    case 'denied':
    case 'action required':
      return (
        <span className="badge-error px-2 py-1 rounded text-xs font-bold flex items-center w-fit">
          <X className="w-3 h-3 mr-1" />
          {status}
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold w-fit">
          {status}
        </span>
      );
  }
}
