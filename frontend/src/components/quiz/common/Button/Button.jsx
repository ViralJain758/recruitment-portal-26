import React from 'react';

export const Button = ({ children, variant = 'primary', className = '', disabled, ...props }) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold tracking-wide whitespace-nowrap transition-all duration-200 rounded-lg active:scale-[.98] hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none select-none";
  
  const variants = {
    primary: "bg-[#0067B8] hover:bg-[#005A9E] text-white shadow-[0_8px_18px_rgba(0,103,184,0.25)]",
    secondary: "bg-white hover:bg-[#F8FAFC] text-[#0067B8] border border-[#E5E7EB] hover:border-[#b3d7ff] shadow-sm",
    success: "bg-[#10B981] hover:bg-[#059669] text-white shadow-[0_8px_18px_rgba(16,185,129,0.2)]",
    danger: "bg-[#EF4444] hover:bg-[#dc2626] text-white shadow-[0_8px_18px_rgba(239,68,68,0.18)]"
  };

  return (
    <button 
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
