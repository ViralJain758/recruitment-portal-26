import React from 'react';
export const Logo = ({ className = 'w-12 h-12' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" fill="#0C1B33" stroke="#2563EB" strokeWidth="4"/>
        <path d="M50 15L80 30V70L50 85L20 70V30L50 15Z" fill="#1D4ED8" opacity="0.4"/>
        <text x="50" y="45" textAnchor="middle" fill="#F8FAFC" fontSize="14" fontWeight="bold" fontFamily="Inter">MLSC</text>
        <circle cx="50" cy="68" r="8" fill="#38BDF8" />
        <path d="M35 68H65" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  );
};