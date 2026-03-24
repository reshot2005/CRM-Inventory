import PageHeader from "@/components/shared/PageHeader";
import { useState } from "react";

export default function CreatePOPage() {
  const [rows, setRows] = useState([{ id: 1, item: "HDPE Granules", qty: 500, unit: "kg", price: 165 }]);

  const subtotal = rows.reduce((acc, row) => acc + row.qty * row.price, 0);
  const gst = subtotal * 0.18;
  const total = subtotal + gst;

  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Purchases", "Purchase Orders", "New"]} title="Create Purchase Order" subtitle="Vendor details, line items, and pricing summary" />
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div>
            <h3 className="font-semibold text-[#0F172A]">Vendor Details</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2"><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Select vendor" /><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" placeholder="Expected delivery" /></div>
          </div>
          <div>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-[#0F172A]">Line Items</h3><button className="rounded bg-[#E0ECFF] px-3 py-1 text-sm text-[#1E3A8A]" onClick={() => setRows((p) => [...p, { id: Date.now(), item: "", qty: 0, unit: "kg", price: 0 }])}>Add Item</button></div>
            <div className="mt-2 space-y-2">
              {rows.map((row) => (
                <div key={row.id} className="grid gap-2 sm:grid-cols-5"><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={row.item} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, item: e.target.value } : r))} placeholder="Item" /><input type="number" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={row.qty} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))} /><input className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={row.unit} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))} /><input type="number" className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={row.price} onChange={(e) => setRows((p) => p.map((r) => r.id === row.id ? { ...r, price: Number(e.target.value) } : r))} /><div className="rounded-lg bg-[#F1F5F9] px-3 py-2 text-sm">?{(row.qty * row.price).toLocaleString("en-IN")}</div></div>
              ))}
            </div>
          </div>
        </section>
        <aside className="h-fit space-y-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 lg:sticky lg:top-24">
          <h3 className="font-semibold">Summary</h3>
          <div className="text-sm"><p>Items: {rows.length}</p><p>Subtotal: ?{subtotal.toLocaleString("en-IN")}</p><p>GST (18%): ?{gst.toLocaleString("en-IN")}</p><p className="mt-2 text-lg font-bold">Total: ?{total.toLocaleString("en-IN")}</p></div>
          <button className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2">Save Draft</button>
          <button className="w-full rounded-lg bg-[#2563EB] px-3 py-2 text-white">Send to Vendor</button>
          <div className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-center text-sm text-[#64748B]">Attach Document</div>
        </aside>
      </div>
    </div>
  );
}
