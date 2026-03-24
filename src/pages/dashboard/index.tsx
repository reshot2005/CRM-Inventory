import { motion } from "framer-motion";
import { MoreHorizontal, ChevronRight, FileText, Check } from "lucide-react";
import { useState } from "react";
import StatCard from "@/components/shared/StatCard";
import AlertBanner from "@/components/shared/AlertBanner";
import PageHeader from "@/components/shared/PageHeader";
import AIChatWidget from "@/components/shared/AIChatWidget";
import StatusBadge from "@/components/shared/StatusBadge";

export default function DashboardIndexPage() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [queryMode, setQueryMode] = useState("Stock Intelligence");
  const [threshold, setThreshold] = useState("Low + Critical");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={["Dashboard"]}
        title="StockOS Overview"
        subtitle="Live inventory, purchases, sales, and production in one place"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total SKUs", value: 1284, iconEmoji: "??", iconBg: "#FFF4F0", ringColor: "#F97316", ringValue: 72 },
          { label: "Low Stock Items", value: 37, iconEmoji: "??", iconBg: "#FEF3C7", ringColor: "#F59E0B", ringValue: 28 },
          { label: "Purchase Orders", value: 94, iconEmoji: "??", iconBg: "#ECFDF3", ringColor: "#22C55E", ringValue: 65 },
          { label: "Pending Deliveries", value: 18, iconEmoji: "??", iconBg: "#E0ECFF", ringColor: "#2563EB", ringValue: 40 },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <StatCard {...card} />
          </motion.div>
        ))}
      </div>

      <AlertBanner
        type="warning"
        message="3 items are critically low on stock"
        action={<a href="#" className="text-sm font-semibold underline">View All Alerts ?</a>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.section className="rounded-2xl bg-white p-6 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="mb-4 text-lg font-bold text-[#0F172A]">Products & SKUs</h2>
          <button className="mb-4 rounded-lg border-2 border-[#2563EB] px-4 py-2 text-sm font-medium text-[#2563EB] hover:bg-[#2563EB] hover:text-white">Add New Product</button>
          <div className="overflow-hidden rounded-xl border border-[#CFD8F5]">
            <table className="w-full">
              <thead className="bg-[#E3EBFF]"><tr><th className="px-4 py-3 text-left text-sm">Item Name</th><th className="px-4 py-3 text-left text-sm">Code</th><th className="px-4 py-3 text-left text-sm">Stock</th><th className="px-4 py-3 text-left text-sm">Min</th><th className="px-4 py-3 text-left text-sm">Status</th></tr></thead>
              <tbody>
                {[
                  ["HDPE Granules", "RAW-001", "143 kg", "500 kg", "warning"],
                  ["PP Woven Sack 50kg", "PKG-011", "2200 pc", "500 pc", "success"],
                  ["Corrugated Sheet B", "PKG-022", "8 pc", "100 pc", "danger"],
                ].map((row, idx) => (
                  <motion.tr key={String(row[1])} className="border-t border-[#CFD8F5] hover:bg-[#E8EEFF]" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + idx * 0.05 }}>
                    <td className="px-4 py-3 text-sm">{row[0]}</td><td className="px-4 py-3 font-mono text-sm text-[#64748B]">{row[1]}</td><td className="px-4 py-3 text-sm">{row[2]}</td><td className="px-4 py-3 text-sm">{row[3]}</td>
                    <td className="px-4 py-3"><StatusBadge label={row[4] === "success" ? "In Stock" : row[4] === "danger" ? "Out" : "Low"} variant={row[4] as "success" | "warning" | "danger"} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        <motion.section className="rounded-2xl bg-white p-6 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0F172A]">Recent Stock Movements</h2>
            <button className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white">View Ledger</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#CFD8F5]">
            <div className="flex items-center justify-between bg-[#E3EBFF] px-4 py-3"><h3 className="text-sm font-semibold">Movements</h3><MoreHorizontal className="h-4 w-4" /></div>
            <table className="w-full">
              <thead className="bg-[#E8EEFF]"><tr><th className="px-4 py-2 text-left text-xs">Item</th><th className="px-4 py-2 text-left text-xs">Type</th><th className="px-4 py-2 text-left text-xs">Qty</th><th className="px-4 py-2 text-left text-xs">Status</th></tr></thead>
              <tbody>
                {[
                  ["HDPE Granules", "IN", "+200 kg", "Received", "success"],
                  ["Carton Box L", "OUT", "-50 pcs", "Dispatched", "info"],
                  ["Adhesive Labels", "OUT", "-300 pcs", "Transferred", "amber"],
                ].map((m, i) => (
                  <motion.tr key={String(m[0])} className="border-t border-[#CFD8F5] hover:bg-[#E8EEFF]" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                    <td className="px-4 py-3 text-sm">{m[0]}</td><td className="px-4 py-3 text-sm">{m[1]}</td><td className="px-4 py-3 text-sm">{m[2]}</td><td className="px-4 py-3"><StatusBadge label={String(m[3])} variant={m[4] as "success" | "info" | "amber"} /></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>

        <motion.section className="rounded-2xl bg-white p-6 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h2 className="mb-4 text-lg font-bold text-[#0F172A]">Vendors</h2>
          <div className="overflow-hidden rounded-xl border border-[#CFD8F5]">
            <table className="w-full"><thead className="bg-[#E3EBFF]"><tr><th className="px-4 py-3 text-left text-sm">Vendor</th><th className="px-4 py-3 text-left text-sm">GSTIN</th><th className="px-4 py-3 text-left text-sm">Materials</th><th className="px-4 py-3 text-left text-sm">Actions</th></tr></thead>
              <tbody>
                {[
                  ["Sharma Polymers", "27AABCS1429B1ZB", "HDPE, PP", "V"],
                  ["PackRight Co.", "29AABCP9021K1ZA", "Cartons, Film", "P"],
                  ["RawMat India", "06AABCR1234M1ZC", "Labels, Tape", "R"],
                ].map((v, i) => (
                  <motion.tr key={String(v[0])} className="border-t border-[#CFD8F5] hover:bg-[#E8EEFF]" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.05 }}>
                    <td className="px-4 py-3 text-sm"><div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#DBEAFE] text-xs font-bold text-[#1E3A8A]">{v[3]}</span>{v[0]}</div></td>
                    <td className="px-4 py-3 font-mono text-sm text-[#64748B]">{v[1]}</td>
                    <td className="px-4 py-3 text-sm">{v[2]}</td>
                    <td className="px-4 py-3 text-sm"><button className="rounded bg-[#E0ECFF] px-2 py-1 text-xs text-[#1E3A8A]">View</button></td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]"><ChevronRight className="h-4 w-4" />View All Vendors</button>
        </motion.section>

        <motion.section className="relative rounded-2xl bg-white p-6 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <h2 className="mb-4 text-lg font-bold text-[#0F172A]">AI Inventory Assistant</h2>
          <div className="absolute right-4 top-4 h-6 w-6 rounded-full bg-[#2563EB]" />
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-[#E3EBFF] p-3">
              <button type="button" onClick={() => setAiEnabled(!aiEnabled)} className={`flex h-5 w-5 items-center justify-center rounded border-2 ${aiEnabled ? "border-[#2563EB] bg-[#2563EB]" : "border-[#64748B]"}`}>{aiEnabled ? <Check className="h-3 w-3 text-white" /> : null}</button>
              <span className="text-sm font-medium">Enable AI Assistant</span>
              <button type="button" onClick={() => setAiEnabled(!aiEnabled)} className={`ml-auto relative h-6 w-11 rounded-full ${aiEnabled ? "bg-[#2563EB]" : "bg-[#CBD5F5]"}`}><motion.div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white" animate={{ x: aiEnabled ? 22 : 2 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} /></button>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#E3EBFF] p-3"><FileText className="h-4 w-4 text-[#64748B]" /><span className="text-sm font-medium">Query Mode</span><select value={queryMode} onChange={(e) => setQueryMode(e.target.value)} className="ml-auto rounded-lg border border-[#CFD8F5] bg-white px-3 py-1.5 text-sm"><option>Stock Intelligence</option><option>Vendor Insights</option><option>Sales Analytics</option></select></div>
            <div className="flex items-center gap-3 rounded-xl bg-[#E3EBFF] p-3"><FileText className="h-4 w-4 text-[#64748B]" /><span className="text-sm font-medium">Alert Threshold</span><select value={threshold} onChange={(e) => setThreshold(e.target.value)} className="ml-auto rounded-lg border border-[#CFD8F5] bg-white px-3 py-1.5 text-sm"><option>Critical Only</option><option>Low + Critical</option><option>All Warnings</option></select></div>
            <button className="w-full rounded-lg bg-[#2563EB] py-2.5 text-sm font-medium text-white">Save Settings</button>
          </div>
        </motion.section>
      </div>

      <motion.div className="flex items-center gap-2 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        {["?? Products", "?? Transfers", "?? Purchases", "?? Deliveries", "?? Reports", "?? Production", "?? Challans"].map((tab) => (
          <button key={tab} className="whitespace-nowrap rounded-lg px-4 py-2 text-sm text-[#64748B] hover:bg-[#E3EBFF] hover:text-[#0F172A]">{tab}</button>
        ))}
      </motion.div>

      <AIChatWidget />
    </div>
  );
}
