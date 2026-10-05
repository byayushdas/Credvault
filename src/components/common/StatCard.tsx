import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'success';
}

export default function StatCard({ label, value, icon: Icon, variant = 'default' }: StatCardProps) {
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          wrapper: 'panel p-5 border-primary-200 ring-1 ring-primary-50',
          label: 'text-primary-700',
          value: 'text-primary-900',
          icon: 'text-primary-500',
        };
      case 'success':
        return {
          wrapper: 'panel p-5 border-emerald-200 ring-1 ring-emerald-50 bg-emerald-50/30',
          label: 'text-emerald-700',
          value: 'text-emerald-700',
          icon: 'text-emerald-500',
        };
      default:
        return {
          wrapper: 'panel p-5',
          label: 'text-slate-500',
          value: 'text-slate-900',
          icon: 'text-slate-400',
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={styles.wrapper}>
      <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${styles.label}`}>
        {label}
      </p>
      <div className="flex items-end justify-between">
        <span className={`text-3xl font-bold ${styles.value}`}>{value}</span>
        <Icon className={`w-5 h-5 mb-1 ${styles.icon}`} />
      </div>
    </div>
  );
}
