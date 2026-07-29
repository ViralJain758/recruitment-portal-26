import React from 'react';
import { ShieldAlert, RefreshCw, Hourglass, Maximize } from 'lucide-react';
export const BottomFeatures = () => {
  const list = [
    { icon: ShieldAlert, t: "Secure Browser" }, { icon: RefreshCw, t: "Auto Save" },
    { icon: Hourglass, t: "Timed Assessment" }, { icon: Maximize, t: "Fullscreen Required" }
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-6 border-t border-[#E5E7EB] w-full select-none">
      {list.map((feat, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
          <feat.icon className="w-5 h-5 text-[#0067B8] flex-shrink-0" />
          <h5 className="text-xs font-semibold text-[#374151]">{feat.t}</h5>
        </div>
      ))}
    </div>
  );
};