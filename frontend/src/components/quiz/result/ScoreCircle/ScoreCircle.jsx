import React from 'react';
export const ScoreCircle = ({ percentage }) => {
  const radius = 70; const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative flex items-center justify-center">
      <svg className="w-44 h-44 transform -rotate-90">
        <circle cx="88" cy="88" r={radius} stroke="#E5E7EB" strokeWidth="10" fill="transparent" />
        <circle cx="88" cy="88" r={radius} stroke="#0067B8" strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={circumference - (percentage / 100) * circumference} strokeLinecap="round" />
      </svg>
      <div className="absolute text-center">
        <span className="text-4xl font-black font-mono text-[#111827]">{percentage}%</span>
        <p className="text-[10px] text-[#111827]0 font-bold uppercase tracking-wider">Score</p>
      </div>
    </div>
  );
};