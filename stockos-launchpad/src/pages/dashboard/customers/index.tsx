import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";

type Customer = { id: string; type: "Business" | "Individual"; name: string; contact: string; city: string; last: string; };

const customers: Customer[] = [
  { id: "CUS-101", type: "Business", name: "Acme Traders", contact: "Rohit Mehta", city: "Mumbai", last: "21 Mar 2025" },
  { id: "CUS-102", type: "Business", name: "RetailX India", contact: "Neha Rao", city: "Delhi", last: "20 Mar 2025" },
  { id: "CUS-103", type: "Individual", name: "Arun Shah", contact: "Arun Shah", city: "Pune", last: "18 Mar 2025" },
];

export default function CustomersPage() {
  const [active, setActive] = useState<Customer>(customers[0]);
  const [tab, setTab] = useState<"Overview" | "Contacts" | "Orders" | "Activity Log">("Overview");

  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Sales", "Customers"]} title="Customers" subtitle="CRM customer profiles with orders, contacts, and activity" />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="max-h-[72vh] space-y-2 overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-3">
          {customers.map((c) => (
            <button key={c.id} onClick={() => setActive(c)} className={`w-full rounded-xl px-3 py-2 text-left ${active.id === c.id ? "bg-[#EFF6FF] border-l-4 border-[#2563EB]" : "hover:bg-[#F8FAFF]"}`}>
              <div className="flex items-center justify-between"><p className="font-medium">{c.name}</p><span className={`rounded-full px-2 py-0.5 text-xs ${c.type === "Business" ? "bg-[#DBEAFE] text-[#1E3A8A]" : "bg-[#ECFDF3] text-[#166534]"}`}>{c.type}</span></div>
              <p className="text-xs text-[#64748B]">{c.contact} · {c.city}</p>
              <p className="text-xs text-[#64748B]">Last order: {c.last}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div className="mb-4 flex items-start justify-between"><div><h2 className="text-xl font-bold">{active.name}</h2><p className="font-mono text-xs text-[#64748B]">{active.id}</p></div><span className={`rounded-full px-2 py-1 text-xs ${active.type === "Business" ? "bg-[#DBEAFE] text-[#1E3A8A]" : "bg-[#ECFDF3] text-[#166534]"}`}>{active.type}</span></div>
          <div className="mb-4 flex flex-wrap gap-2">{(["Overview", "Contacts", "Orders", "Activity Log"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 text-sm ${tab === t ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}>{t}</button>)}</div>

          {tab === "Overview" ? <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="text-[#64748B]">Customer ID</p><p className="font-mono">{active.id}</p><p className="mt-2 text-[#64748B]">Primary Contact</p><p>{active.contact}</p></div><div className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="text-[#64748B]">Address</p><p>{active.city}, India</p><p className="mt-2 text-[#64748B]">Total Spend</p><p>?8,42,500</p></div><div className="sm:col-span-2 rounded-xl border border-[#E2E8F0] p-3"><div className="h-[180px] rounded-lg bg-[#E0ECFF] p-4 text-sm text-[#1E3A8A]">?? GMaps location placeholder</div></div></div> : null}
          {tab === "Contacts" ? <div className="space-y-2">{[{name:"Rohit Mehta", role:"Procurement", phone:"+91 9988776655", email:"rohit@acme.com"}, {name:"Asha Iyer", role:"Accounts", phone:"+91 8877665544", email:"asha@acme.com"}].map((p) => <div key={p.email} className="rounded-xl border border-[#E2E8F0] p-3 text-sm"><p className="font-medium">{p.name}</p><p className="text-xs text-[#64748B]">{p.role}</p><p>{p.phone}</p><p>{p.email}</p></div>)}</div> : null}
          {tab === "Orders" ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F1F5F9]"><tr><th className="px-3 py-2 text-left">SO</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Amount</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Challan</th></tr></thead><tbody><tr className="border-t"><td className="px-3 py-2 font-mono">SO-1892</td><td>21 Mar</td><td>?1,24,000</td><td>Confirmed</td><td>DC-2041</td></tr></tbody></table></div> : null}
          {tab === "Activity Log" ? <div className="space-y-3 text-sm">{["?? Order SO-1892 placed — ?1,24,000 — 21 Mar 2025", "?? Delivery Challan DC-2041 generated — 21 Mar 2025", "?? Note added: Customer prefers delivery before 5pm — 20 Mar", "? Order SO-1885 delivered — 15 Mar 2025"].map((l) => <div key={l} className="rounded-xl border border-[#E2E8F0] p-3">{l}</div>)}<button className="rounded-lg bg-[#2563EB] px-3 py-2 text-white">Add Note</button></div> : null}
        </div>
      </div>
    </div>
  );
}
