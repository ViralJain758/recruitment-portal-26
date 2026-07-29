import React from 'react';
import { useExam } from '../../../context/ExamContext';
import mlsaLogo from '../../../assets/mlsa-logo.png';

export const Navbar = () => {
  const { candidate } = useExam();

  return (
    <nav className="w-full bg-white/90 backdrop-blur-md border-b border-[#E5E7EB] shadow-sm px-6 py-3 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <img 
          src={mlsaLogo} 
          alt="MLSA Shield Logo" 
          className="w-9 h-auto object-contain" 
        />
        <div className="h-5 w-px bg-[#E5E7EB]" />
        <span className="text-sm font-bold text-[#111827] tracking-wide">
          MLSC Portal
        </span>
      </div>

      {candidate && (
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-[#374151] font-medium">{candidate.fullName}</span>
          <span className="text-[#D1D5DB]">|</span>
          <span className="text-[#0067B8] bg-[#0067B8]/10 border border-[#0067B8]/15 px-2 py-0.5 rounded-md text-[11px]">
            {candidate.enrollmentNumber}
          </span>
        </div>
      )}
    </nav>
  );
};