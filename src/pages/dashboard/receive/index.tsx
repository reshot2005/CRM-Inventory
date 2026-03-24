import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";

const pending = [
  { po: "PO-2041", vendor: "Sharma Polymers", expected: "25 Mar 2025", items: 3 },
  { po: "PO-2040", vendor: "PackRight Co.", expected: "22 Mar 2025", items: 5 },
];

type History = { receipt: string; po: string; vendor: string; date: string; items: string; by: string; doc: string; };
const history: History[] = [
  { receipt: "RCV-1008", po: "PO-2039", vendor: "RawMat India", date: "19 Mar 2025", items: "2", by: "Arun", doc: "invoice-2039.pdf" },
  { receipt: "RCV-1007", po: "PO-2038", vendor: "ChemPlast", date: "17 Mar 2025", items: "1", by: "Priya", doc: "invoice-2038.pdf" },
];

const columns: DataColumn<History>[] = [
  { id: "receipt", header: "Receipt #", render: (r) => <span className="font-mono text-[#2563EB]">{r.receipt}</span> },
  { id: "po", header: "PO #", render: (r) => <span className="font-mono">{r.po}</span> },
  { id: "vendor", header: "Vendor", render: (r) => r.vendor },
  { id: "date", header: "Date", render: (r) => r.date },
  { id: "items", header: "Items", render: (r) => r.items },
  { id: "by", header: "By", render: (r) => r.by },
  { id: "doc", header: "Document", render: (r) => r.doc },
];

export default function ReceiveStockPage() {
  const [selected, setSelected] = useState(pending[0]);

  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Purchases", "Receive Stock"]} title="Receive Stock" subtitle="Confirm inbound inventory against purchase orders" />

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[#0F172A]">Awaiting Receipt (18)</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {pending.map((card) => (
            <button key={card.po} onClick={() => setSelected(card)} className={`rounded-xl border p-4 text-left ${selected.po === card.po ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0] bg-white"}`}>
              <p className="font-mono text-sm text-[#2563EB]">{card.po}</p>
              <p className="text-sm text-[#0F172A]">{card.vendor}</p>
              <p className="text-xs text-[#64748B]">Expected: {card.expected} · {card.items} items</p>
              <span className="mt-2 inline-flex rounded bg-[#2563EB] px-2 py-1 text-xs text-white">Receive</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
        <h4 className="font-semibold">{selected.po} · {selected.vendor} · {selected.items} items pending</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#F1F5F9]"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2">Ordered</th><th className="px-3 py-2">Received</th><th className="px-3 py-2">Receiving Now</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Batch#</th><th className="px-3 py-2">Expiry</th><th className="px-3 py-2">Location</th></tr></thead>
            <tbody>
              <tr className="border-t"><td className="px-3 py-2">HDPE Granules</td><td className="text-center">500</td><td className="text-center">200</td><td className="px-2 py-2"><input className="w-24 rounded border border-[#E2E8F0] bg-[#E0ECFF] px-2 py-1" defaultValue={300} /></td><td className="text-center">kg</td><td className="px-2 py-2"><input className="w-28 rounded border border-[#E2E8F0] px-2 py-1 font-mono" defaultValue="HDG-2025" /></td><td className="px-2 py-2"><input className="rounded border border-[#E2E8F0] px-2 py-1" placeholder="optional" /></td><td className="px-2 py-2"><select className="rounded border border-[#E2E8F0] px-2 py-1"><option>Factory</option><option>Mumbai Hub</option></select></td></tr>
              <tr className="border-t"><td className="px-3 py-2">PP Woven Sack</td><td className="text-center">1000</td><td className="text-center">0</td><td className="px-2 py-2"><input className="w-24 rounded border border-[#E2E8F0] bg-[#E0ECFF] px-2 py-1" defaultValue={1000} /></td><td className="text-center">pcs</td><td className="px-2 py-2"><input className="w-28 rounded border border-[#E2E8F0] px-2 py-1 font-mono" defaultValue="PPW-874" /></td><td className="px-2 py-2"><input className="rounded border border-[#E2E8F0] px-2 py-1" placeholder="optional" /></td><td className="px-2 py-2"><select className="rounded border border-[#E2E8F0] px-2 py-1"><option>Factory</option><option>Mumbai Hub</option></select></td></tr>
            </tbody>
          </table>
        </div>
        <label className="mt-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> Mark as fully received</label>
        <div className="mt-3 rounded-lg border border-dashed border-[#CBD5E1] p-4 text-sm text-[#64748B]">Attach invoice/receipt</div>
        <button className="mt-3 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white">Confirm Receipt</button>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-[#0F172A]">Receive History</h3>
        <DataTable columns={columns} data={history} totalItems={history.length} />
      </section>
    </div>
  );
}
