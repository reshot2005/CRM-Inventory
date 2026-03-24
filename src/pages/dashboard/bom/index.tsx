import { useMemo, useState } from "react";
import PageHeader from "@/components/shared/PageHeader";

const boms = [
  { fg: "HDPE Pipe 50mm", code: "FG-102", components: 3, updated: "21 Mar 2025", status: "Active" },
  { fg: "PVC Joint Set", code: "FG-205", components: 4, updated: "19 Mar 2025", status: "Active" },
  { fg: "Connector Batch", code: "FG-310", components: 2, updated: "17 Mar 2025", status: "Draft" },
];

export default function BillsOfMaterialsPage() {
  const [active, setActive] = useState(boms[0]);
  const [target, setTarget] = useState(100);

  const calc = useMemo(() => {
    const requirements = [
      { item: "HDPE Granules", code: "RAW-001", perUnit: 0.5, available: 143, unit: "kg" },
      { item: "Master Batch", code: "RAW-012", perUnit: 0.02, available: 45, unit: "kg" },
      { item: "Packaging Sleeve", code: "PKG-011", perUnit: 1, available: 2200, unit: "pcs" },
    ];
    return requirements.map((r) => ({ ...r, required: r.perUnit * target, short: Math.max(r.perUnit * target - r.available, 0), possible: Math.floor(r.available / r.perUnit) }));
  }, [target]);

  const possible = Math.min(...calc.map((r) => r.possible));

  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Manufacturing", "Bills of Materials"]} title="Bills of Materials" subtitle="Visual BOM mapping with yield calculator and shortfall intelligence" actions={<button className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm text-white">Create BOM</button>} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="max-h-[72vh] space-y-2 overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-3">
          {boms.map((b) => <button key={b.code} onClick={() => setActive(b)} className={`w-full rounded-xl border p-3 text-left ${active.code === b.code ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#E2E8F0] hover:bg-[#F8FAFF]"}`}><p className="font-medium">{b.fg}</p><p className="font-mono text-xs text-[#64748B]">{b.code}</p><p className="text-xs text-[#64748B]">{b.components} components · {b.updated}</p><span className="mt-1 inline-flex rounded-full bg-[#F1F5F9] px-2 py-0.5 text-xs">{b.status}</span></button>)}
        </div>

        <section className="space-y-4 rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div><h2 className="text-xl font-bold text-[#0F172A]">{active.fg}</h2><p className="font-mono text-xs text-[#64748B]">{active.code}</p><p className="text-sm text-[#64748B]">Produces: 1 unit</p></div>
          <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]"><table className="w-full min-w-[680px] text-sm"><thead className="bg-[#F1F5F9]"><tr><th className="px-3 py-2 text-left">Component</th><th className="px-3 py-2 text-left">Code</th><th className="px-3 py-2">Qty / unit</th><th className="px-3 py-2">Current stock</th><th className="px-3 py-2">Enough for</th></tr></thead><tbody>{calc.map((r) => <tr key={r.code} className="border-t"><td className="px-3 py-2">{r.item}</td><td className="font-mono text-[#64748B]">{r.code}</td><td className="text-center">{r.perUnit} {r.unit}</td><td className="text-center">{r.available} {r.unit}</td><td className="text-center">{r.possible} units</td></tr>)}</tbody></table></div>
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFF] p-4"><p className="text-sm text-[#64748B]">With current stock, you can produce:</p><p className="text-3xl font-bold text-[#0F172A]">{possible} units</p></div>
          <div className="rounded-xl border border-[#E2E8F0] p-4"><p className="text-sm font-semibold">Yield Calculator</p><div className="mt-2 flex items-center gap-2"><input type="number" className="w-32 rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)} /><span className="text-sm text-[#64748B]">units</span></div><div className="mt-3 space-y-2 text-sm">{calc.map((r) => <div key={`${r.code}-calc`} className="flex items-center justify-between rounded bg-[#F1F5F9] px-3 py-2"><span>{r.item}</span><span className={r.short > 0 ? "text-[#DC2626]" : "text-[#16A34A]"}>{r.required.toFixed(2)} req / {r.available} avail</span></div>)}</div>{calc.some((r) => r.short > 0) ? <button className="mt-3 rounded-lg bg-[#2563EB] px-3 py-2 text-sm text-white">Create Purchase Order for Shortfall</button> : null}</div>
        </section>
      </div>
    </div>
  );
}
