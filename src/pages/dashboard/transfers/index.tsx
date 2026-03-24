import { useMemo, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import StatusBadge from "@/components/shared/StatusBadge";

const tabs = ["All", "Draft", "Pending", "In Transit", "Received", "Cancelled"];
const transfers = [
  { id: "TR-1021", from: "Factory", to: "Mumbai Hub", items: 4, date: "21 Mar 2025", status: "In Transit" },
  { id: "TR-1020", from: "Factory", to: "Delhi Hub", items: 2, date: "20 Mar 2025", status: "Pending" },
  { id: "TR-1019", from: "Pune Hub", to: "Factory", items: 1, date: "19 Mar 2025", status: "Received" },
];

export default function StockTransfersPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [selected, setSelected] = useState(transfers[0]);

  const filtered = useMemo(() => activeTab === "All" ? transfers : transfers.filter((t) => t.status === activeTab), [activeTab]);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Warehouses", "Stock Transfers"]}
        title="Stock Transfers"
        subtitle="Move order tracking across factory and hubs"
        actions={<button className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-medium text-white">Create Transfer</button>}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-full px-3 py-1.5 text-sm ${activeTab === tab ? "bg-[#2563EB] text-white" : "bg-white text-[#64748B] border border-[#E2E8F0]"}`}>{tab}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-3">
          {filtered.map((t) => (
            <button key={t.id} onClick={() => setSelected(t)} className={`w-full rounded-xl border p-4 text-left transition ${selected.id === t.id ? "border-l-4 border-l-[#2563EB] border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0] hover:bg-[#F8FAFF]"}`}>
              <div className="flex items-center justify-between"><p className="font-mono text-sm text-[#2563EB]">{t.id}</p><StatusBadge variant={t.status === "Received" ? "success" : t.status === "Pending" ? "warning" : "info"} label={t.status} /></div>
              <p className="mt-1 text-sm text-[#0F172A]">{t.from} ? {t.to}</p>
              <p className="mt-1 text-xs text-[#64748B]">{t.items} items · {t.date}</p>
              <div className="mt-2 h-1.5 rounded bg-[#E2E8F0]"><div className="h-1.5 w-2/3 rounded bg-[#2563EB]" /></div>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><h3 className="font-heading text-lg font-bold text-[#0F172A]">{selected.id}</h3><p className="text-sm text-[#64748B]">Created on {selected.date}</p></div>
            <StatusBadge variant={selected.status === "Received" ? "success" : selected.status === "Pending" ? "warning" : "info"} label={selected.status} />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] p-4">
            <p className="text-sm font-semibold">Flow</p>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm"><span className="rounded-lg bg-[#F1F5F9] px-3 py-2">{selected.from}</span><span className="flex-1 border-t-2 border-dashed border-[#2563EB]" /><span className="rounded-lg bg-[#F1F5F9] px-3 py-2">{selected.to}</span></div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2E8F0]">
            <table className="w-full min-w-[620px] text-sm"><thead className="bg-[#F1F5F9]"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2">Requested</th><th className="px-3 py-2">Sent</th><th className="px-3 py-2">Received</th></tr></thead><tbody><tr className="border-t"><td className="px-3 py-2">HDPE Granules</td><td className="font-mono text-[#64748B]">RAW-001</td><td className="text-center">200 kg</td><td className="text-center">200 kg</td><td className="text-center">0 kg</td></tr><tr className="border-t"><td className="px-3 py-2">PP Woven Sack</td><td className="font-mono text-[#64748B]">PKG-011</td><td className="text-center">300 pc</td><td className="text-center">300 pc</td><td className="text-center">0 pc</td></tr></tbody></table>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white">Mark Dispatched</button>
            <button className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm">Confirm Received</button>
            <button className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#DC2626]">Cancel</button>
          </div>
        </section>
      </div>
    </div>
  );
}
