import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";

type Item = { name: string; code: string; type: "bag" | "roll" | "box"; qty: number; min: number; icon: string; };

const items: Item[] = [
  { name: "PP Woven Sack", code: "PKG-011", type: "bag", qty: 2200, min: 500, icon: "??" },
  { name: "Stretch Wrap Film", code: "PKG-033", type: "roll", qty: 340, min: 100, icon: "??" },
  { name: "Corrugated Sheet B", code: "PKG-022", type: "box", qty: 8, min: 100, icon: "??" },
  { name: "PremiumBond Tape", code: "PKG-045", type: "roll", qty: 200, min: 1000, icon: "??" },
];

const colors = { bag: "#DBEAFE", roll: "#DCFCE7", box: "#FEF3C7" };

const tableCols: DataColumn<Item>[] = [
  { id: "name", header: "Name", render: (r) => r.name },
  { id: "code", header: "Code", render: (r) => <span className="font-mono text-[#64748B]">{r.code}</span> },
  { id: "type", header: "Type", render: (r) => r.type },
  { id: "qty", header: "Qty", render: (r) => r.qty },
  { id: "min", header: "Min", render: (r) => r.min },
  { id: "action", header: "Action", render: (r) => <button className={`rounded px-2 py-1 text-xs ${r.qty < r.min ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9]"}`}>{r.qty < r.min ? "Reorder" : "View"}</button> },
];

export default function PackagingPage() {
  const [view, setView] = useState<"card" | "table">("card");
  const cardItems = useMemo(() => items, []);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Inventory", "Packaging Materials"]}
        title="Packaging Materials"
        subtitle="Kanban-style packaging inventory with reorder intelligence"
        actions={<div className="rounded-xl border border-[#E2E8F0] bg-white p-1 text-sm"><button onClick={() => setView("table")} className={`rounded-lg px-3 py-1 ${view === "table" ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>Table view</button><button onClick={() => setView("card")} className={`rounded-lg px-3 py-1 ${view === "card" ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>Card view</button></div>}
      />

      {view === "card" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardItems.map((it, idx) => {
            const ratio = Math.min((it.qty / it.min) * 100, 100);
            return (
              <motion.div key={it.code} className="rounded-2xl border border-[#E2E8F0] bg-white p-4 transition hover:-translate-y-1 hover:border-[#2563EB] hover:shadow-[0_8px_24px_rgba(37,99,235,0.1)]" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <div className="mb-3 h-1.5 rounded-full" style={{ backgroundColor: colors[it.type] }} />
                <div className="text-3xl">{it.icon}</div>
                <h3 className="mt-2 text-[15px] font-semibold text-[#0F172A]">{it.name}</h3>
                <p className="font-mono text-xs text-[#64748B]">{it.code}</p>
                <p className="mt-2 text-xs text-[#64748B]">Current: {it.qty} / Min: {it.min}</p>
                <div className="mt-1 h-2 rounded bg-[#E2E8F0]"><div className="h-2 rounded" style={{ width: `${ratio}%`, backgroundColor: it.qty < it.min ? "#EF4444" : "#22C55E" }} /></div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded bg-[#F1F5F9] px-2 py-1 text-xs">{it.qty}</span>
                  {it.qty < it.min ? <button className="rounded bg-[#2563EB] px-2 py-1 text-xs text-white">Reorder</button> : <button className="rounded bg-[#F1F5F9] px-2 py-1 text-xs">Details</button>}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <DataTable columns={tableCols} data={items} totalItems={items.length} />
      )}
    </div>
  );
}
