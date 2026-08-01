import React from 'react';
import { motion } from 'framer-motion';

export const Card = ({ children, className = '', ...props }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        type: 'spring', 
        stiffness: 260, 
        damping: 22,
        y: { duration: 0.2 },
        scale: { duration: 0.2 }
      }}
      className={`bg-white border border-[#E5E7EB] rounded-lg p-6 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};
