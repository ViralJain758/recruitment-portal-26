import React from 'react';
import { Card } from '../../common/Card';
import { Clock, HelpCircle, Layers, ShieldCheck, Zap } from 'lucide-react';
export const ExamInfoCard = () => {
  const specs = [
    { icon: Clock, label: "Duration", val: "30 Minutes" },
    { icon: HelpCircle, label: "Questions", val: "20" },
    { icon: Layers, label: "Sections", val: "Aptitude, Technical, Logical" },
    { icon: Zap, label: "Auto Save", val: "Enabled" },
    { icon: ShieldCheck, label: "Secure Browser", val: "Fullscreen Mode Required" }
  ];
  return (
    <Card className="flex flex-col justify-between border-[#E5E7EB] bg-white">
      <div>
        <h3 className="text-lg font-bold text-[#111827] mb-4 border-b border-[#E5E7EB] pb-3">About Examination</h3>
        <div className="space-y-4">
          {specs.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3.5">
              <div className="p-1.5 bg-[#0067B8]/10 border border-[#0067B8]/15 rounded-md mt-0.5">
                <item.icon className="w-4 h-4 text-[#0067B8]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#6B7280]">{item.label}</p>
                <p className="text-sm font-medium text-[#111827]">{item.val}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg">
        <p className="text-xs text-[#6B7280] leading-relaxed font-medium">⚠️ <span className="text-[#b45309]">No Negative Marking.</span> Ensure stable connectivity before launching.</p>
      </div>
    </Card>
  );
};