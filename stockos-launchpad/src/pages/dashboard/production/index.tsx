import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import RightPanel from "@/components/shared/RightPanel";

const columns = ["Planned", "In Progress", "Paused", "Completed", "Blocked"] as const;
const board = {
  "Planned": [{ id: "MO-122", name: "HDPE Pipe 50mm", deadline: "02-02-25", progress: 20, assignee: "AS", qty: 100 }],
  "In Progress": [{ id: "MO-121", name: "PVC Joint Set", deadline: "01-02-25", progress: 62, assignee: "PR", qty: 140 }],
  "Paused": [{ id: "MO-119", name: "Connector Batch", deadline: "29-01-25", progress: 33, assignee: "RK", qty: 80 }],
  "Completed": [{ id: "MO-118", name: "Cable Sleeve", deadline: "27-01-25", progress: 100, assignee: "AA", qty: 50 }],
  "Blocked": [{ id: "MO-117", name: "ProFlex Cap", deadline: "26-01-25", progress: 45, assignee: "PM", qty: 75 }],
};

export default function ProductionOrdersPage() {
  const [active, setActive] = useState(board["In Progress"][0]);

  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Manufacturing", "Production Orders"]} title="Production Orders" subtitle="Plan, execute, and track manufacturing status in real time" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Planned", 8], ["In Progress", 3], ["Completed Today", 5], ["Materials Short", 2], ["Avg Completion", 4.2]].map((kpi) => <div key={String(kpi[0])} className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3"><p className="text-xs text-[#64748B]">{kpi[0]}</p><p className="text-lg font-bold text-[#0F172A]">{String(kpi[1])}</p></div>)}</div>
      <div className="overflow-x-auto"><div className="grid min-w-[1100px] grid-cols-5 gap-4">{columns.map((col) => <div key={col} className="rounded-2xl border border-[#E2E8F0] bg-white p-3"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${col === "Blocked" ? "bg-[#EF4444]" : col === "Completed" ? "bg-[#22C55E]" : col === "In Progress" ? "bg-[#2563EB]" : "bg-[#64748B]"}`} /><h3 className="font-semibold text-sm">{col}</h3></div><span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs">{board[col].length}</span></div><div className="space-y-2">{board[col].map((card) => <button key={card.id} onClick={() => setActive(card)} className="w-full rounded-xl border border-[#E2E8F0] p-3 text-left hover:bg-[#F8FAFF]"><div className="flex items-center justify-between"><p className="font-mono text-xs text-[#2563EB]">{card.id}</p><p className="text-xs text-[#64748B]">{card.deadline}</p></div><p className="mt-1 text-sm font-medium">{card.name}</p><div className="mt-2 h-2 rounded bg-[#E2E8F0]"><div className="h-2 rounded bg-[#2563EB]" style={{ width: `${card.progress}%` }} /></div><p className="mt-2 text-xs text-[#64748B]">Assigned: {card.assignee} · Qty: {card.qty}</p></button>)}</div></div>)}</div></div>
      <RightPanel open={Boolean(active)} onClose={() => setActive(null as never)} title={active?.id ?? ""} subtitle={active?.name ?? ""}>
        {active ? <div className="space-y-4"><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p>Target Qty: {active.qty}</p><p>Deadline: {active.deadline}</p></div><div className="rounded-xl border border-[#E2E8F0] p-3"><p className="text-sm font-semibold">BOM Tree</p><div className="mt-2 space-y-2 text-xs"><div className="rounded border border-[#2563EB]/30 bg-[#EFF6FF] p-2">Finished Good: HDPE Pipe 50mm — 100 units</div><div className="ml-4 rounded border border-[#22C55E]/30 bg-[#ECFDF3] p-2">HDPE: 50kg ? In Stock</div><div className="ml-4 rounded border border-[#F59E0B]/30 bg-[#FEF3C7] p-2">Color Masterbatch: 2kg ?? Low</div></div></div><div className="grid gap-2 sm:grid-cols-2"><button className="rounded-lg bg-[#2563EB] px-3 py-2 text-white">Start Production</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2">Pause</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2">Mark Complete</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-[#DC2626]">Cancel</button></div></div> : null}
      </RightPanel>
    </div>
  );
}
