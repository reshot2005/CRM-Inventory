import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  cta?: ReactNode;
}

export default function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-2 py-14 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-3xl">{icon}</div>
      <h3 className="font-heading text-lg font-bold text-[#0F172A]">{title}</h3>
      <p className="max-w-md text-sm text-[#64748B]">{description}</p>
      {cta ? <div className="mt-2">{cta}</div> : null}
    </motion.div>
  );
}
