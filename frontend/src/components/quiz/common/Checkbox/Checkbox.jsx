import React from 'react';
export const Checkbox = ({ label, id, className = '', ...props }) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <input type="checkbox" id={id} className="w-4 h-4 rounded border-[#D1D5DB] bg-white text-[#0067B8] focus:ring-[#0067B8]/30 focus:ring-offset-0 accent-[#0067B8] cursor-pointer" {...props} />
      {label && <label htmlFor={id} className="text-xs font-medium text-[#6B7280] cursor-pointer">{label}</label>}
    </div>
  );
};