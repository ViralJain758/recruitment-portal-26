import React from 'react';
import { Card } from '../../common/Card';
export const PerformanceCard = ({ stats }) => {
  return (
    <Card className="border-[#E5E7EB] bg-[#F8FAFC] p-6 space-y-3 text-sm text-[#374151]">
      <div>Correct Answers: <span className="text-[#059669] font-bold font-mono">{stats.correct}</span></div>
      <div>Incorrect Answers: <span className="text-[#dc2626] font-bold font-mono">{stats.wrong}</span></div>
      <div>Skipped Questions: <span className="text-[#6B7280] font-bold font-mono">{stats.unanswered}</span></div>
      <div>Time Taken: <span className="text-[#0067B8] font-bold font-mono">{stats.timeTaken}</span></div>
    </Card>
  );
};