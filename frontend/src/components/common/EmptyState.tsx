import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionTo }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-500 text-sm max-w-sm mb-6">{description}</p>
      {actionLabel && actionTo && (
        <Link 
          to={actionTo}
          className="px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-primary-700 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
