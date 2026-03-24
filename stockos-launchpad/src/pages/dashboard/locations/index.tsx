import { motion } from "framer-motion";
import PageHeader from "@/components/shared/PageHeader";

const locations = [
  { name: "Factory", type: "??", accent: "#2563EB", featured: true, skus: 1284, low: 17, updated: "2 min ago", value: "?14,20,500" },
  { name: "Mumbai Hub", type: "??", accent: "#22C55E", featured: false, skus: 840, low: 8, updated: "9 min ago", value: "?5,11,300" },
  { name: "Delhi Hub", type: "??", accent: "#F59E0B", featured: false, skus: 620, low: 6, updated: "15 min ago", value: "?3,90,200" },
  { name: "Pune Hub", type: "??", accent: "#2563EB", featured: false, skus: 500, low: 3, updated: "23 min ago", value: "?2,44,900" },
];

export default function LocationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Warehouses", "All Locations"]}
        title="All Locations"
        subtitle="Factory and hubs with location-wise stock metrics"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {locations.map((loc, i) => (
          <motion.div
            key={loc.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`min-w-[240px] rounded-2xl border p-4 ${loc.featured ? "border-transparent text-white" : "border-[#E2E8F0] bg-white"}`}
            style={loc.featured ? { background: "linear-gradient(135deg,#1E2B4A,#2563EB)" } : { borderLeftColor: loc.accent, borderLeftWidth: 4 }}
          >
            <div className="flex items-center justify-between"><h3 className="font-semibold">{loc.type} {loc.name}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${loc.featured ? "bg-white/20" : "bg-[#F1F5F9] text-[#64748B]"}`}>{loc.featured ? "Primary Location" : "Hub"}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><p className={`${loc.featured ? "text-white/70" : "text-[#64748B]"}`}>Total SKUs</p><p className="text-base font-bold">{loc.skus}</p></div>
              <div><p className={`${loc.featured ? "text-white/70" : "text-[#64748B]"}`}>Low Stock</p><p className="text-base font-bold">{loc.low}</p></div>
              <div><p className={`${loc.featured ? "text-white/70" : "text-[#64748B]"}`}>Last Updated</p><p>{loc.updated}</p></div>
              <div><p className={`${loc.featured ? "text-white/70" : "text-[#64748B]"}`}>Stock Value</p><p>{loc.value}</p></div>
            </div>
            <button className={`mt-3 w-full rounded-lg border px-3 py-2 text-sm ${loc.featured ? "border-white/30 bg-white/10" : "border-[#E2E8F0] bg-white"}`}>View Stock</button>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {["Total Locations: 4", "Active Transfers: 7", "Pending Receive: 3"].map((s) => (
          <div key={s} className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-medium text-[#0F172A]">{s}</div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-[#F1F5F9]"><tr><th className="sticky left-0 bg-[#F1F5F9] px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3">Factory</th><th className="px-4 py-3">Mumbai Hub</th><th className="px-4 py-3">Delhi Hub</th><th className="px-4 py-3">Pune Hub</th><th className="px-4 py-3">Total</th></tr></thead>
          <tbody>
            {[
              ["HDPE Granules", "RAW-001", 143, 24, 0, 12],
              ["PP Woven Sack", "PKG-011", 2200, 430, 300, 120],
              ["Corrugated Sheet B", "PKG-022", 8, 0, 12, 4],
              ["Adhesive Labels", "PKG-045", 200, 50, 0, 10],
            ].map((r) => {
              const total = Number(r[2]) + Number(r[3]) + Number(r[4]) + Number(r[5]);
              return (
                <tr key={String(r[1])} className="border-t border-[#F1F5F9] text-center">
                  <td className="sticky left-0 bg-white px-4 py-3 text-left">{r[0]}</td>
                  <td className="font-mono text-[#64748B]">{r[1]}</td>
                  {[r[2], r[3], r[4], r[5]].map((v, i) => (
                    <td key={i} className={`${Number(v) === 0 ? "text-[#EF4444]" : Number(v) < 20 ? "text-[#B45309]" : "text-[#16A34A]"}`}>{String(v)}</td>
                  ))}
                  <td className="font-semibold">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
