import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import RightPanel from "@/components/shared/RightPanel";

const columns = ["Draft", "Confirmed", "Dispatched", "Delivered"];
const board: Record<string, { id: string; customer: string; qty: string; amount: string; date: string }[]> = {
  Draft: [{ id: "SO-1890", customer: "BuildFast Co.", qty: "7 items", amount: "?2,86,000", date: "19 Mar" }],
  Confirmed: [{ id: "SO-1892", customer: "Acme Traders", qty: "4 items", amount: "?1,24,000", date: "21 Mar" }],
  Dispatched: [{ id: "SO-1891", customer: "RetailX India", qty: "2 items", amount: "?48,500", date: "20 Mar" }],
  Delivered: [{ id: "SO-1889", customer: "GrowthHub Pvt", qty: "1 item", amount: "?15,200", date: "18 Mar" }],
};

type Row = { so: string; date: string; customer: string; items: string; amount: string; status: "Draft" | "Confirmed" | "Dispatched" | "Delivered"; location: string; };
const rows: Row[] = [
  { so: "SO-1892", date: "21 Mar", customer: "Acme Traders", items: "4 items", amount: "?1,24,000", status: "Confirmed", location: "Factory" },
  { so: "SO-1891", date: "20 Mar", customer: "RetailX India", items: "2 items", amount: "?48,500", status: "Dispatched", location: "Mumbai" },
  { so: "SO-1890", date: "19 Mar", customer: "BuildFast Co.", items: "7 items", amount: "?2,86,000", status: "Draft", location: "—" },
  { so: "SO-1889", date: "18 Mar", customer: "GrowthHub Pvt", items: "1 item", amount: "?15,200", status: "Delivered", location: "Delhi" },
];
const tableCols: DataColumn<Row>[] = [
  { id: "so", header: "SO Number", render: (r) => <span className="font-mono text-[#2563EB]">{r.so}</span> },
  { id: "date", header: "Date", render: (r) => r.date },
  { id: "customer", header: "Customer", render: (r) => r.customer },
  { id: "items", header: "Items", render: (r) => r.items },
  { id: "amount", header: "Total Amt", render: (r) => r.amount },
  { id: "status", header: "Status", render: (r) => <StatusBadge variant={r.status === "Delivered" ? "success" : r.status === "Dispatched" ? "amber" : r.status === "Confirmed" ? "info" : "neutral"} label={r.status} /> },
  { id: "location", header: "Location", render: (r) => r.location },
  { id: "actions", header: "Actions", render: () => <button className="rounded bg-[#F1F5F9] px-2 py-1 text-xs">?</button> },
];

export default function SalesOrdersPage() {
  const [pipeline, setPipeline] = useState(true);
  const [active, setActive] = useState<Row | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Sales", "Sales Orders"]}
        title="Sales Orders"
        subtitle="Pipeline and table views for end-to-end order tracking"
        actions={<div className="rounded-xl border border-[#E2E8F0] bg-white p-1 text-sm"><button onClick={() => setPipeline(true)} className={`rounded-lg px-3 py-1 ${pipeline ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>Pipeline View</button><button onClick={() => setPipeline(false)} className={`rounded-lg px-3 py-1 ${!pipeline ? "bg-[#2563EB] text-white" : "text-[#64748B]"}`}>Table View</button></div>}
      />

      {pipeline ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-4 gap-4">
            {columns.map((col) => (
              <div key={col} className="rounded-2xl border border-[#E2E8F0] bg-white p-3">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-[#0F172A]">{col}</h3><span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs">{board[col].length}</span></div>
                <div className="space-y-2">
                  {board[col].map((card) => (
                    <div key={card.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3 text-sm">
                      <p className="font-mono text-[#2563EB]">{card.id}</p>
                      <p className="font-medium text-[#0F172A]">{card.customer}</p>
                      <p className="text-xs text-[#64748B]">{card.qty} · {card.amount} · {card.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DataTable columns={tableCols} data={rows} onRowClick={setActive} totalItems={rows.length} />
      )}

      <RightPanel open={Boolean(active)} onClose={() => setActive(null)} title={active?.so ?? ""} subtitle={active?.customer ?? ""}>
        {active ? <div className="space-y-4"><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="font-semibold">Customer</p><p>{active.customer}</p><p className="text-xs text-[#64748B]">Type: Business · Contact: +91 9988776655</p></div><div className="rounded-xl border border-[#E2E8F0] p-3"><p className="text-sm font-semibold">Line Items</p><table className="mt-2 w-full text-xs"><tbody><tr><td>HDPE Pipe 50mm</td><td className="font-mono">FG-102</td><td>200</td></tr><tr><td>PP Woven Sack</td><td className="font-mono">PKG-011</td><td>500</td></tr></tbody></table></div><button className="w-full rounded-lg bg-[#2563EB] px-3 py-2 text-white">Generate Delivery Challan</button></div> : null}
      </RightPanel>
    </div>
  );
}
