import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import { Package, Factory, Users, Truck, FileText } from "lucide-react";

const modules = [
  {
    icon: Package,
    title: "Inventory Service",
    features: ["Real-time stock levels across Factory + all Hubs", "Move Order creation (Sale / Transfer)", "Minimum stock level alerts with reorder CTA"],
    demo: {
      label: "Stock Overview",
      rows: [
        { item: "HDPE Granules", code: "RM-0412", loc: "Factory", qty: "512 kg", status: "OK" },
        { item: "Labels 100x50", code: "PM-0124", loc: "Mumbai", qty: "200", status: "Low" },
        { item: "Widget Pro", code: "FG-1001", loc: "Delhi", qty: "89", status: "OK" },
      ],
    },
  },
  {
    icon: Factory,
    title: "Manufacturing Service",
    features: ["Bill of Materials: raw materials → finished good", "Pre-production vs post-production tracking", "Packaging material consumption tracking"],
    demo: {
      label: "Production Order #PO-2041",
      rows: [
        { item: "HDPE Granules", code: "RM-0412", loc: "BOM", qty: "25 kg", status: "Consumed" },
        { item: "Adhesive Label", code: "PM-0124", loc: "BOM", qty: "100", status: "Consumed" },
        { item: "Widget Pro", code: "FG-1001", loc: "Output", qty: "+20", status: "Produced" },
      ],
    },
  },
  {
    icon: Users,
    title: "CRM Service",
    features: ["Customer profiles: Individual or Business", "Multiple contacts, GMaps location", "Full activity log with timestamps"],
    demo: {
      label: "Customer: Bharat Electronics Ltd",
      rows: [
        { item: "Type", code: "", loc: "", qty: "Business", status: "Active" },
        { item: "POC", code: "", loc: "", qty: "Arun K.", status: "Primary" },
        { item: "Last Order", code: "SO-1892", loc: "", qty: "₹2.4L", status: "Completed" },
      ],
    },
  },
  {
    icon: Truck,
    title: "Vendor Management",
    features: ["Vendor ID, GSTIN, multiple POCs", "Raw material linkage — vendor ↔ materials", "Document attachments (contracts, certificates)"],
    demo: {
      label: "Vendor: PolyMax Industries",
      rows: [
        { item: "GSTIN", code: "", loc: "", qty: "27AAACR5055K1ZK", status: "Verified" },
        { item: "Materials", code: "", loc: "", qty: "HDPE, LDPE", status: "Active" },
        { item: "Terms", code: "", loc: "", qty: "Net 30", status: "Standard" },
      ],
    },
  },
  {
    icon: FileText,
    title: "Sales & Documents",
    features: ["Delivery Challan creator with PDF template", "Cloud storage: Invoices, Bills, Photos", "Downloadable + stored automatically"],
    demo: {
      label: "Delivery Challan #DC-2041",
      rows: [
        { item: "From", code: "", loc: "", qty: "Factory Hub", status: "" },
        { item: "To", code: "", loc: "", qty: "RetailChain Delhi", status: "" },
        { item: "Items", code: "", loc: "", qty: "Widget Pro ×50", status: "Dispatched" },
      ],
    },
  },
];

const ModuleShowcase = () => {
  const [active, setActive] = useState(0);
  const mod = modules[active];

  return (
    <section className="py-24 px-4 bg-primary-section">
      <div className="max-w-6xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <span className="font-mono text-xs text-cobalt tracking-[0.2em] uppercase">Modules</span>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-foreground mt-3">
            Five core modules. One platform.
          </h2>
        </AnimatedSection>

        <div className="grid md:grid-cols-5 gap-3 mb-8">
          {modules.map((m, i) => (
            <motion.button
              key={m.title}
              onClick={() => setActive(i)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 font-body text-sm ${
                active === i ? "bg-cobalt text-primary-foreground border-cobalt" : "bg-card border-border text-muted-foreground hover:border-cobalt/40"
              }`}
            >
              <m.icon className="w-5 h-5" />
              <span className="font-semibold text-xs">{m.title.split(" ")[0]}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="grid md:grid-cols-2 gap-8"
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-cobalt flex items-center justify-center">
                  <mod.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="font-heading font-bold text-2xl text-foreground">{mod.title}</h3>
              </div>
              <ul className="space-y-3">
                {mod.features.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3 text-muted-foreground font-body"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cobalt mt-2 shrink-0" />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </div>

            <div className="bg-navy rounded-2xl p-5 glow-cobalt">
              <div className="flex items-center justify-between mb-4">
                <span className="font-heading font-bold text-sm text-primary-foreground">{mod.demo.label}</span>
                <span className="w-2 h-2 rounded-full bg-cobalt pulse-soft" />
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {mod.demo.rows.map((r, i) => (
                    <motion.tr
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className="border-t border-primary-foreground/5"
                    >
                      <td className="py-2 text-primary-foreground/80 font-body">{r.item}</td>
                      <td className="py-2 font-mono text-primary-foreground/50">{r.code}</td>
                      <td className="py-2 text-primary-foreground/60 font-body">{r.qty}</td>
                      <td className="py-2">
                        {r.status && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-body ${
                            r.status === "Low" ? "bg-red-500/20 text-red-400" :
                            r.status === "OK" || r.status === "Active" || r.status === "Verified" || r.status === "Produced" || r.status === "Completed" || r.status === "Dispatched"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-cobalt/20 text-cobalt"
                          }`}>{r.status}</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
};

export default ModuleShowcase;
