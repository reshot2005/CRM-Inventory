import { Link } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import RightPanel from "@/components/shared/RightPanel";
import { useState } from "react";

type Row = { po: string; date: string; vendor: string; items: string; amount: string; status: "Draft" | "Sent" | "Partially Received" | "Received"; expected: string; };
const rows: Row[] = [
  { po: "PO-2041", date: "20 Mar 2025", vendor: "Sharma Polymers", items: "3 items", amount: "?82,500", status: "Sent", expected: "25 Mar 2025" },
  { po: "PO-2040", date: "18 Mar 2025", vendor: "PackRight Co.", items: "5 items", amount: "?41,200", status: "Partially Received", expected: "22 Mar 2025" },
  { po: "PO-2039", date: "15 Mar 2025", vendor: "RawMat India", items: "2 items", amount: "?1,18,000", status: "Received", expected: "18 Mar 2025" },
  { po: "PO-2038", date: "12 Mar 2025", vendor: "ChemPlast Supply", items: "1 item", amount: "?64,800", status: "Draft", expected: "—" },
];
const columns: DataColumn<Row>[] = [
  { id: "po", header: "PO Number", render: (r) => <span className="font-mono text-[#2563EB]">{r.po}</span>, sortValue: (r) => r.po },
  { id: "date", header: "Date", render: (r) => r.date },
  { id: "vendor", header: "Vendor", render: (r) => r.vendor },
  { id: "items", header: "Items", render: (r) => r.items },
  { id: "amount", header: "Total Amt", render: (r) => r.amount },
  { id: "status", header: "Status", render: (r) => <StatusBadge variant={r.status === "Received" ? "success" : r.status === "Partially Received" ? "amber" : r.status === "Sent" ? "info" : "neutral"} label={r.status} /> },
  { id: "expected", header: "Expected", render: (r) => r.expected },
  { id: "actions", header: "Actions", render: () => <button className="rounded bg-[#F1F5F9] px-2 py-1 text-xs">?</button> },
];

export default function PurchaseOrdersPage() {
  const [selected, setSelected] = useState<Row | null>(null);
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Purchases", "Purchase Orders"]}
        title="Purchase Orders"
        subtitle="Vendor purchase workflow with receiving timeline"
        actions={<><Link to="/dashboard/purchase-orders/new" className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-medium text-white">Create Purchase Order</Link></>}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total POs", "94"],
          ["Open", "23"],
          ["Awaiting Delivery", "18"],
          ["This Month", "?4,28,000"],
        ].map((kpi, i) => <div key={String(kpi[0])} className="rounded-xl border-l-4 border-[#2563EB] bg-white px-4 py-3"><p className="text-xs text-[#64748B]">{kpi[0]}</p><p className="text-lg font-bold text-[#0F172A]">{kpi[1]}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-2"><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Date range" /><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Vendor" /><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Status" /><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Search" /></div>
      <div className="flex gap-2">{["All", "Draft", "Sent", "Partially Received", "Received", "Cancelled"].map((tab) => <button key={tab} className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm">{tab}</button>)}</div>
      <DataTable columns={columns} data={rows} onRowClick={setSelected} totalItems={rows.length} />
      <RightPanel open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.po ?? ""} subtitle={selected?.vendor ?? ""}>
        {selected ? <div className="space-y-4"><div className="rounded-xl border border-[#E2E8F0] p-3"><p className="text-sm font-semibold">Vendor</p><p className="mt-1">{selected.vendor}</p><p className="font-mono text-xs text-[#64748B]">GSTIN: 27AABCS1429B1ZB</p><a className="text-xs text-[#2563EB]" href="#">View Vendor ?</a></div><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="font-semibold">Line Items</p><table className="mt-2 w-full text-xs"><tbody><tr><td>HDPE Granules</td><td className="font-mono">RAW-001</td><td>500kg</td><td>200kg</td><td>?165/kg</td></tr><tr><td>PP Woven Sack</td><td className="font-mono">PKG-011</td><td>1000pc</td><td>1000pc</td><td>?22/pc</td></tr></tbody></table></div><div className="grid grid-cols-2 gap-2"><button className="rounded-lg bg-[#2563EB] px-3 py-2 text-white">Record Receipt</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2">Edit PO</button></div></div> : null}
      </RightPanel>
    </div>
  );
}
