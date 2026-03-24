import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: number;
  iconEmoji: string;
  iconBg: string;
  ringColor: string;
  ringValue: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  iconEmoji,
  iconBg,
  ringColor,
  ringValue,
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1000;
    const from = 0;
    const to = value;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(from + (to - from) * progress);
      setDisplayValue(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    const id = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(id);
  }, [value]);

  const size = 52;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.div
      className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4"
      whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(37,99,235,0.1)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: iconBg }}
        >
          <span>{iconEmoji}</span>
        </div>
        <div>
          <p className="text-[12px] font-medium text-[#334155]">{label}</p>
          <p className="text-xl font-semibold leading-tight text-[#0F172A] sm:text-2xl">
            {displayValue}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{
              strokeDashoffset:
                circumference - (ringValue / 100) * circumference,
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
      </div>
    </motion.div>
  );
};

export default StatCard;
