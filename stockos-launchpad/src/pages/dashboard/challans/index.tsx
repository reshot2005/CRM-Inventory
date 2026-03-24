import PageHeader from "@/components/shared/PageHeader";

const challans = [
  { dc: "DC-2041", so: "SO-1892", customer: "Acme Traders", date: "21 Mar 2025", items: 2, status: "Generated" },
  { dc: "DC-2040", so: "SO-1891", customer: "RetailX India", date: "20 Mar 2025", items: 4, status: "Delivered" },
  { dc: "DC-2039", so: "SO-1890", customer: "BuildFast Co.", date: "19 Mar 2025", items: 3, status: "Draft" },
];

export default function DeliveryChallansPage() {
  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Sales", "Delivery Challans"]} title="Delivery Challans" subtitle="Generate, preview, and download challan PDFs" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="max-h-[72vh] space-y-2 overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-3">
          {challans.map((c) => (
            <div key={c.dc} className="rounded-xl border border-[#E2E8F0] p-3 text-sm hover:bg-[#F8FAFF]">
              <div className="flex items-center justify-between"><p className="font-mono text-[#2563EB]">{c.dc}</p><span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs">{c.status}</span></div>
              <p className="mt-1">SO: {c.so}</p>
              <p className="text-[#64748B]">{c.customer} · {c.date} · {c.items} items</p>
              <button className="mt-2 rounded bg-[#E0ECFF] px-2 py-1 text-xs text-[#1E3A8A]">Download PDF</button>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
          <div className="mx-auto max-w-[680px] scale-[0.92] rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3"><div><p className="text-xl font-bold text-[#0F172A]">StockOS</p><p className="text-sm text-[#64748B]">Delivery Challan</p></div><p className="font-mono text-sm text-[#2563EB]">DC #2041</p></div>
            <div className="mt-3 text-sm"><p><strong>From:</strong> StockOS Factory, Pune</p><p><strong>To:</strong> Acme Traders, Andheri, Mumbai</p><p><strong>Date:</strong> 21 Mar 2025</p></div>
            <table className="mt-4 w-full text-sm"><thead className="bg-[#F1F5F9]"><tr><th className="px-2 py-2 text-left">#</th><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 text-left">Code</th><th className="px-2 py-2 text-left">Qty</th><th className="px-2 py-2 text-left">Unit</th></tr></thead><tbody><tr className="border-t"><td className="px-2 py-2">1</td><td>HDPE Granules</td><td className="font-mono">RAW-001</td><td>200</td><td>kg</td></tr><tr className="border-t"><td className="px-2 py-2">2</td><td>PP Woven Sack</td><td className="font-mono">PKG-011</td><td>500</td><td>pcs</td></tr></tbody></table>
            <p className="mt-6 text-right text-sm">Authorized Signature</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2"><button className="rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white">Download PDF</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">Print</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">Share</button><button className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm">Edit</button></div>
        </section>
      </div>
    </div>
  );
}
