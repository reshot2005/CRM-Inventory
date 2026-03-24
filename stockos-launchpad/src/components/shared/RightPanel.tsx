import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface RightPanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function RightPanel({ open, title, subtitle, onClose, children }: RightPanelProps) {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[420px] overflow-y-auto border-l border-[#E2E8F0] bg-white p-5 sm:w-[420px]"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="font-heading text-lg font-bold text-[#0F172A]">{title}</h3>
                {subtitle ? <p className="text-xs text-[#64748B]">{subtitle}</p> : null}
              </div>
              <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#F1F5F9]">
                <X className="h-4 w-4 text-[#64748B]" />
              </button>
            </div>
            {children}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
