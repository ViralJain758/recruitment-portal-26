import React, { useEffect } from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Clock } from 'lucide-react';

export const TimerCard = () => {
  const { timeLeft, setTimeLeft, completeExam } = useExam();

  // Total initial duration of the exam (e.g., 1 hour = 3600 seconds)
  const totalDuration = 3600; 

  useEffect(() => {
    if (timeLeft <= 0) {
      completeExam();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, completeExam, setTimeLeft]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return { hours: h, minutes: m, seconds: s };
  };

  const { hours, minutes, seconds } = formatTime(timeLeft);

  // Percentage calculations
  const percentageLeft = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));
  
  // Calculate exact rotation degrees for the clock hand (0 to 360 deg)
  // Winding down from 360 back to 0 as time runs out
  const rotationDegrees = (timeLeft / totalDuration) * 360;

  // Color logic matching your system benchmarks
  let clockThemeColor = 'text-emerald-500 stroke-emerald-500';
  let digitsColor = 'text-[#059669]'; // Safe green
  let pulseOverlay = '';

  if (percentageLeft <= 15) {
    clockThemeColor = 'text-rose-500 stroke-rose-500';
    digitsColor = 'text-[#DC2626]'; // Critical red
    pulseOverlay = 'animate-pulse bg-rose-500/5 absolute inset-1 rounded-full';
  } else if (percentageLeft <= 35) {
    clockThemeColor = 'text-amber-500 stroke-amber-500';
    digitsColor = 'text-[#D97706]'; // Warning orange/amber
  }

  return (
    <Card className="p-4 sm:p-5 border-[#E5E7EB] bg-white relative overflow-hidden select-none">
      <div className="flex items-center justify-between">
        
        {/* Left Side: Layout Data */}
        <div className="space-y-3 min-w-0">
          <div className="flex items-center gap-2 text-[#6B7280] tracking-wider">
            <Clock className="w-4 h-4 text-[#6B7280]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Time Remaining</span>
          </div>
          
          {/* Numbers Area */}
          <div className={`flex items-center gap-1.5 sm:gap-2 font-sans antialiased tracking-tight transition-colors duration-300 ${digitsColor}`}>
            <span className="text-3xl sm:text-4xl font-extrabold font-mono">{hours}</span>
            <span className="text-lg sm:text-xl font-bold opacity-60">:</span>
            <span className="text-3xl sm:text-4xl font-extrabold font-mono">{minutes}</span>
            <span className="text-lg sm:text-xl font-bold opacity-60">:</span>
            <span className="text-3xl sm:text-4xl font-extrabold font-mono">
              {seconds}
            </span>
          </div>
        </div>

        {/* Right Side: True Analog Clock Display */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center flex-shrink-0">
          
          <div className={pulseOverlay} />

          {/* Clock Dial Structure */}
          <svg className="w-full h-full" viewBox="0 0 64 64">
            {/* Outer Rim Ring */}
            <circle 
              cx="32" cy="32" r="28" 
              className="stroke-[#E5E7EB]" 
              strokeWidth="2" 
              fill="transparent" 
            />
            
            {/* Subtle Clock Hour Ticks */}
            <g className="stroke-[#D1D5DB]" strokeWidth="1.5" strokeLinecap="round">
              <line x1="32" y1="6" x2="32" y2="9" />   {/* 12 o'clock */}
              <line x1="58" y1="32" x2="55" y2="32" /> {/* 3 o'clock */}
              <line x1="32" y1="58" x2="32" y2="55" /> {/* 6 o'clock */}
              <line x1="6" y1="32" x2="9" y2="32" />   {/* 9 o'clock */}
            </g>

            {/* Moving Clock Hand Ring Axis */}
            <g 
              transform={`rotate(${rotationDegrees} 32 32)`} 
              className="transition-transform duration-1000 ease-linear"
            >
              {/* Sweeping Center Hand pointing to current time status */}
              <line 
                x1="32" y1="32" 
                x2="32" y2="10" 
                className={`stroke-2 stroke-linecap-round ${clockThemeColor.split(' ')[1]}`}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>

            {/* Solid Center Core Pin */}
            <circle 
              cx="32" cy="32" r="2.5" 
              className={`fill-white stroke-2 ${clockThemeColor.split(' ')[1]}`} 
            />
          </svg>
          
        </div>

      </div>
    </Card>
  );
};
