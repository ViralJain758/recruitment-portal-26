import React from 'react';
export const Badge = ({ children, variant = 'info', className = '' }) => {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    danger: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    muted: 'bg-slate-800 border-slate-700 text-slate-400'
  };
  return <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border tracking-wide select-none ${styles[variant]} ${className}`}>{children}</span>;
};