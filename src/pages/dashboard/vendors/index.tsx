import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import RightPanel from "@/components/shared/RightPanel";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";

type Vendor = { name: string; id: string; gstin: string; materials: string; terms: string; spent: string; };
const vendors: Vendor[] = [
  { name: "Sharma Polymers", id: "VEN-001", gstin: "27AABCS1429B1ZB", materials: "HDPE, PP", terms: "Net 30", spent: "?3,12,000" },
  { name: "PackRight Co.", id: "VEN-014", gstin: "29AABCP9021K1ZA", materials: "Cartons, Film", terms: "Net 15", spent: "?1,85,500" },
  { name: "RawMat India", id: "VEN-022", gstin: "06AABCR1234M1ZC", materials: "Labels, Tape", terms: "Net 21", spent: "?2,44,900" },
];

const columns: DataColumn<Vendor>[] = [
  { id: "name", header: "Vendor", render: (v) => v.name },
  { id: "id", header: "Vendor ID", render: (v) => <span className="font-mono text-[#64748B]">{v.id}</span> },
  { id: "gstin", header: "GSTIN", render: (v) => <span className="font-mono text-[#64748B]">{v.gstin}</span> },
  { id: "materials", header: "Materials", render: (v) => v.materials },
  { id: "terms", header: "Payment Terms", render: (v) => v.terms },
  { id: "spent", header: "Total Value", render: (v) => v.spent },
];

export default function VendorsPage() {
  const [active, setActive] = useState<Vendor | null>(vendors[0]);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Purchases", "Vendors"]}
        title="Vendors"
        subtitle="Manage vendor profiles, contacts, documents, and purchase history"
        actions={<button className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-medium text-white">Add Vendor</button>}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="max-h-[72vh] space-y-2 overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-3">
          {vendors.map((v) => (
            <button key={v.id} onClick={() => setActive(v)} className={`w-full rounded-xl px-3 py-2 text-left transition ${active?.id === v.id ? "bg-[#EFF6FF] border-l-4 border-[#2563EB]" : "hover:bg-[#F8FAFF]"}`}>
              <p className="font-medium text-[#0F172A]">{v.name}</p>
              <p className="font-mono text-xs text-[#64748B]">{v.gstin}</p>
              <p className="text-xs text-[#64748B]">Last PO: 20 Mar 2025</p>
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
          {active ? (
            <>
              <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold text-[#0F172A]">{active.name}</h2><p className="font-mono text-xs text-[#64748B]">{active.id}</p></div><span className="rounded-full bg-[#DCFCE7] px-2 py-1 text-xs text-[#166534]">Active Vendor</span></div>
              <div className="grid gap-3 sm:grid-cols-4">{[["Total Orders", "34"], ["Total Value", active.spent], ["Last Order", "20 Mar 2025"], ["On-time", "93%"]].map((s) => <div key={s[0]} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-3"><p className="text-xs text-[#64748B]">{s[0]}</p><p className="text-sm font-semibold">{s[1]}</p></div>)}</div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="text-[#64748B]">GSTIN</p><p className="font-mono">{active.gstin}</p><p className="mt-2 text-[#64748B]">Payment Terms</p><p>{active.terms}</p></div><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="text-[#64748B]">Materials Supplied</p><div className="mt-2 flex flex-wrap gap-2">{active.materials.split(", ").map((m) => <span key={m} className="rounded-full bg-[#E0ECFF] px-2 py-1 text-xs">{m}</span>)}</div></div></div>
              <h3 className="font-semibold">Purchase History</h3>
              <DataTable columns={[{ id: "po", header: "PO Number", render: (r: {po:string; date:string; amount:string; status:string;}) => <span className="font-mono text-[#2563EB]">{r.po}</span> }, { id: "date", header: "Date", render: (r:{date:string}) => r.date }, { id: "amount", header: "Amount", render: (r:{amount:string}) => r.amount }, { id: "status", header: "Status", render: (r:{status:string}) => r.status }]} data={[{ po: "PO-2041", date: "20 Mar 2025", amount: "?82,500", status: "Sent" }, { po: "PO-2033", date: "11 Mar 2025", amount: "?54,200", status: "Received" }]} />
            </>
          ) : null}
        </div>
      </div>

      <RightPanel open={false} title="" onClose={() => {}}>
        <div />
      </RightPanel>
    </div>
  );
}
