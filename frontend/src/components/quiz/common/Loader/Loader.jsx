import React from 'react';
export const Loader = ({ size = 'medium', className = '' }) => {
  const dimensions = { small: 'w-4 h-4 border-2', medium: 'w-8 h-8 border-3', large: 'w-12 h-12 border-4' };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${dimensions[size]} border-slate-800 border-t-blue-500 rounded-full animate-spin`} />
    </div>
  );
};