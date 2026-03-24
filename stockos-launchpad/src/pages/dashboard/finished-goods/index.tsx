import { useState } from "react";
import { ChevronDown } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";
import MiniChart from "@/components/shared/MiniChart";

type Row = { item: string; code: string; brand: string; pkgType: string; qty: string; committed: string; expected: string; };

const rows: Row[] = [
  { item: "HDPE Pipe 50mm", code: "FG-102", brand: "StockFlow", pkgType: "Bundle", qty: "420", committed: "102", expected: "120" },
  { item: "PVC Joint Set", code: "FG-205", brand: "StockFlow", pkgType: "Box", qty: "680", committed: "80", expected: "0" },
  { item: "Custom Fitting Kit", code: "FG-341", brand: "ProFlex", pkgType: "Packet", qty: "150", committed: "20", expected: "50" },
];

const columns: DataColumn<Row>[] = [
  { id: "item", header: "Item", render: (r) => r.item },
  { id: "code", header: "Product Code", render: (r) => <span className="font-mono text-[#64748B]">{r.code}</span> },
  { id: "brand", header: "Brand", render: (r) => r.brand },
  { id: "pkg", header: "Pkg Type", render: (r) => r.pkgType },
  { id: "qty", header: "Qty Available", render: (r) => r.qty },
  { id: "committed", header: "Committed", render: (r) => r.committed },
  { id: "expected", header: "Expected", render: (r) => r.expected },
  { id: "actions", header: "Actions", render: () => <button className="rounded bg-[#F1F5F9] px-2 py-1 text-xs">?</button> },
];

export default function FinishedGoodsPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Inventory", "Finished Goods"]}
        title="Finished Goods"
        subtitle="Committed vs available stock with value and movement analytics"
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <DataTable columns={columns} data={rows} totalItems={rows.length} />

          <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
            <button type="button" onClick={() => setOpen((p) => !p)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <h3 className="font-semibold text-[#0F172A]">Carton/Packaged Goods</h3>
              <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
              <div className="overflow-x-auto border-t border-[#E2E8F0] px-4 py-3">
                <table className="w-full min-w-[600px] text-sm">
                  <thead><tr className="text-left text-[#64748B]"><th>Product Name</th><th>Product Code</th><th>Product Qty</th><th>Brand</th><th>Package Size</th><th>Number of Packages</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-[#F1F5F9]"><td className="py-2">Pipe Boxed Kit</td><td className="font-mono">FG-BOX-44</td><td>560</td><td>StockFlow</td><td>10 units</td><td>56</td></tr>
                    <tr className="border-t border-[#F1F5F9]"><td className="py-2">Joint Combo Pack</td><td className="font-mono">FG-BOX-21</td><td>240</td><td>ProFlex</td><td>8 units</td><td>30</td></tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-sm text-[#64748B]">Finished Goods Value</p>
            <p className="mt-1 text-2xl font-bold text-[#0F172A]">?24,86,500</p>
            <p className="text-xs text-[#16A34A]">+12.4% from last month</p>
            <div className="mt-3"><MiniChart data={[18, 22, 19, 26, 28, 30, 34]} color="#2563EB" /></div>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <h4 className="text-sm font-semibold text-[#0F172A]">Fastest Moving</h4>
            {[
              ["HDPE Pipe 50mm", 82],
              ["PVC Joint Set", 66],
              ["Custom Fitting Kit", 52],
            ].map(([name, val]) => (
              <div key={String(name)} className="mt-3">
                <div className="flex items-center justify-between text-xs"><span>{name}</span><span>{val}%</span></div>
                <div className="mt-1 h-2 rounded bg-[#E2E8F0]"><div className="h-2 rounded bg-[#2563EB]" style={{ width: `${val}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <h4 className="text-sm font-semibold text-[#0F172A]">Brand Distribution</h4>
            <div className="mx-auto mt-3 h-28 w-28 rounded-full" style={{ background: "conic-gradient(#2563EB 0deg 162deg, #22C55E 162deg 270deg, #F59E0B 270deg 360deg)" }} />
            <p className="mt-2 text-xs text-[#64748B]">Brand A 45% · Brand B 30% · Brand C 25%</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
