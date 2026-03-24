import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import StatCard from "@/components/shared/StatCard";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";

type Row = { date: string; item: string; code: string; type: string; qty: string; reason: string; location: string; by: string; status: "Pending Approval" | "Approved" | "Rejected"; };

const rows: Row[] = [
  { date: "22 Mar", item: "HDPE Granules", code: "RAW-001", type: "Add", qty: "+24", reason: "Count Correction", location: "Factory", by: "Arun", status: "Pending Approval" },
  { date: "21 Mar", item: "Corrugated Sheet B", code: "PKG-022", type: "Remove", qty: "-12", reason: "Damaged", location: "Mumbai Hub", by: "Priya", status: "Approved" },
  { date: "20 Mar", item: "Adhesive Labels", code: "PKG-045", type: "Correct", qty: "-5", reason: "Expired", location: "Delhi Hub", by: "Amit", status: "Rejected" },
];

const columns: DataColumn<Row>[] = [
  { id: "date", header: "Date", render: (r) => r.date },
  { id: "item", header: "Item", render: (r) => r.item },
  { id: "code", header: "Code", render: (r) => <span className="font-mono text-[#64748B]">{r.code}</span> },
  { id: "type", header: "Type", render: (r) => r.type },
  { id: "qty", header: "Qty", render: (r) => <span className={r.qty.startsWith("+") ? "text-[#16A34A]" : "text-[#DC2626]"}>{r.qty}</span> },
  { id: "reason", header: "Reason", render: (r) => r.reason },
  { id: "location", header: "Location", render: (r) => r.location },
  { id: "by", header: "By", render: (r) => r.by },
  { id: "status", header: "Status", render: (r) => <StatusBadge variant={r.status === "Approved" ? "success" : r.status === "Rejected" ? "danger" : "warning"} label={r.status} /> },
  {
    id: "actions",
    header: "Actions",
    render: (r) => r.status === "Pending Approval" ? <div className="flex gap-1"><button className="rounded bg-[#DCFCE7] px-2 py-1 text-xs text-[#166534]">Approve</button><button className="rounded bg-[#FEE2E2] px-2 py-1 text-xs text-[#991B1B]">Reject</button></div> : "—",
  },
];

export default function StockAdjustmentsPage() {
  const [type, setType] = useState("Add Stock");

  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Warehouses", "Stock Adjustments"]} title="Stock Adjustments" subtitle="Reason-based stock corrections with approval workflow" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Adjustments This Month" value={24} iconEmoji="??" iconBg="#E0ECFF" ringColor="#2563EB" ringValue={60} />
        <StatCard label="Total Added" value={2840} iconEmoji="?" iconBg="#ECFDF3" ringColor="#22C55E" ringValue={70} />
        <StatCard label="Total Removed" value={1230} iconEmoji="?" iconBg="#FEE2E2" ringColor="#EF4444" ringValue={36} />
      </div>

      <div className="flex flex-wrap gap-2">
        {["Add Stock", "Remove Stock", "Correct Count"].map((opt) => (
          <button key={opt} onClick={() => setType(opt)} className={`rounded-full px-4 py-2 text-sm ${type === opt ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] bg-white"}`}>{opt}</button>
        ))}
      </div>

      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Item" />
          <input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Location" />
          <input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Qty" />
          <input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Reason" />
          <input className="md:col-span-3 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Notes" />
          <button className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white">Submit Adjustment</button>
        </div>
      </section>

      <DataTable columns={columns} data={rows} totalItems={rows.length} />
    </div>
  );
}
