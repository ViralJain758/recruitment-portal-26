import React from 'react';
import { motion } from 'framer-motion';

export const PageContainer = ({ children, className = '' }) => {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className={`min-h-[calc(100svh-65px)] w-full max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col ${className}`}
    >
      {children}
    </motion.main>
  );
};
