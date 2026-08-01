import React from 'react';
export const Input = ({ label, icon: Icon, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && <label className="text-xs font-semibold text-[#374151] select-none">{label}</label>}
      <div className="relative flex items-center">
        {Icon && <Icon className="absolute left-4 w-4 h-4 text-[#9CA3AF] pointer-events-none" />}
        <input className={`w-full bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#111827] py-3 placeholder-[#9CA3AF] transition-all duration-200 focus:outline-none focus:border-[#0067B8] focus:ring-4 focus:ring-[#0067B8]/10 ${Icon ? 'pl-10 pr-4' : 'px-4'}`} {...props} />
      </div>
    </div>
  );
};