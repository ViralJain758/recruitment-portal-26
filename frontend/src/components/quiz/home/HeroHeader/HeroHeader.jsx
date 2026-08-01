import React from 'react';
import { motion } from 'framer-motion';
// Step 1: Correctly import the new official MLSA logo asset
import mlsaLogo from '../../../assets/mlsa-logo.png'; 

export const HeroHeader = () => {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.12
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.96 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: 'spring', stiffness: 100, damping: 15 }
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center text-center mb-10 max-w-xl mx-auto select-none"
    >
      
      {/* Step 2: Swap the old div icon for the official high-res brand image */}
      <motion.img 
        variants={itemVariants}
        src={mlsaLogo} 
        alt="Microsoft Learn Student Ambassadors Logo" 
        className="w-24 h-24 object-contain mb-6 drop-shadow-[0_12px_20px_rgba(0,103,184,0.18)]"
      />

      <motion.h1 
        variants={itemVariants}
        className="text-4xl font-extrabold text-[#111827] tracking-tight sm:text-5xl"
      >
        Recruitment Portal
      </motion.h1>
      
      <motion.p 
        variants={itemVariants}
        className="text-sm font-semibold text-[#0067B8] mt-2 tracking-wide uppercase"
      >
        Microsoft Learn Student Chapter
      </motion.p>

      {/* Recruitment Status Pill */}
      <motion.div 
        variants={itemVariants}
        className="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/20 text-[#059669] text-xs font-bold tracking-wider uppercase font-mono"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
        Recruitment 2026 Open
      </motion.div>
    </motion.div>
  );
};