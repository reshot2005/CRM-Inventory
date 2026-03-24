import { motion } from "framer-motion";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "amber";

const styleMap: Record<Variant, string> = {
  success: "bg-[#DCFCE7] text-[#16A34A]",
  warning: "bg-[#FEF3C7] text-[#B45309]",
  danger: "bg-[#FEE2E2] text-[#DC2626]",
  info: "bg-[#DBEAFE] text-[#1E3A8A]",
  neutral: "bg-[#E2E8F0] text-[#334155]",
  amber: "bg-[#FEF9C3] text-[#854D0E]",
};

const dotMap: Record<Variant, string> = {
  success: "bg-[#22C55E]",
  warning: "bg-[#F59E0B]",
  danger: "bg-[#EF4444]",
  info: "bg-[#2563EB]",
  neutral: "bg-[#64748B]",
  amber: "bg-[#D97706]",
};

interface StatusBadgeProps {
  label: string;
  variant: Variant;
}

export default function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styleMap[variant]}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotMap[variant]}`} />
      {label}
    </motion.span>
  );
}
