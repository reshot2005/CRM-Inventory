import { motion } from "framer-motion";
import { Package, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import PageHeader from "@/components/shared/PageHeader";
import SearchFilterBar from "@/components/shared/SearchFilterBar";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";
import StatCard from "@/components/shared/StatCard";

interface StatConfig {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  ringColor: string;
  ringValue: number;
}

interface ModuleTablePageProps<T> {
  breadcrumb: string[];
  title: string;
  subtitle: string;
  stats: StatConfig[];
  columns: DataColumn<T>[];
  data: T[];
  alert?: ReactNode;
  searchPlaceholder?: string;
  addLabel?: string;
}

export default function ModuleTablePage<T>({
  breadcrumb,
  title,
  subtitle,
  stats,
  columns,
  data,
  alert,
  searchPlaceholder,
  addLabel,
}: ModuleTablePageProps<T>) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} subtitle={subtitle} breadcrumb={breadcrumb} />
      {alert}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <StatCard {...card} />
          </motion.div>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <SearchFilterBar placeholder={searchPlaceholder} addLabel={addLabel} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <DataTable columns={columns} data={data} totalItems={data.length} emptyState={{ icon: <Package className="mx-auto h-10 w-10 text-[#94A3B8]" strokeWidth={1.5} />, title: `No ${title.toLowerCase()} yet`, description: "Add your first record to start tracking inventory.", cta: <button className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-medium text-white">Create</button> }} />
      </motion.div>
    </div>
  );
}
