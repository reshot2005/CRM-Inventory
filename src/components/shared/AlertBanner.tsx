import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface AlertBannerProps {
  type: "warning" | "danger" | "info";
  message: string;
  action?: ReactNode;
  onDismiss?: () => void;
}

const styles = {
  warning: "border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]",
  danger: "border-[#EF4444] bg-[#FEE2E2] text-[#991B1B]",
  info: "border-[#2563EB] bg-[#DBEAFE] text-[#1E3A8A]",
};

export default function AlertBanner({ type, message, action, onDismiss }: AlertBannerProps) {
  return (
    <motion.div
      className={`flex items-center justify-between gap-3 rounded-xl border-l-4 px-5 py-3 ${styles[type]}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-sm font-medium">{message}</p>
      <div className="flex items-center gap-3">
        {action}
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="text-xs underline">
            Dismiss
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
