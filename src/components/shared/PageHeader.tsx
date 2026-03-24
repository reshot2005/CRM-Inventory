import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb: string[];
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: PageHeaderProps) {
  return (
    <motion.header
      className="mb-5 border-b border-[#E2E8F0] pb-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1 text-xs text-[#64748B]">
            {breadcrumb.map((crumb, index) => (
              <span key={`${crumb}-${index}`} className="inline-flex items-center gap-1">
                {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                <span>{crumb}</span>
              </span>
            ))}
          </div>
          <h1 className="font-heading text-[22px] font-bold text-[#0F172A]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-[13px] text-[#64748B]">{subtitle}</p>
          ) : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </motion.header>
  );
}
