import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import AnimatedSection from "./AnimatedSection";
import { Plus, ArrowRight, Factory, FileCheck } from "lucide-react";

const ease = [0.16, 1, 0.3, 1];

const steps = [
  {
    title: "Add Your Items & Raw Materials",
    desc: "Define Product Code, Standardized Name, Brand, Packaging Type, Min Stock Level — all structured and searchable.",
    icon: Plus,
    demo: (
      <div className="space-y-2 font-mono text-xs text-primary-foreground/70">
        {["Product Code: RM-0412", "Name: HDPE Granules", "Brand: PolyMax", "Pack: 25kg Bag", "Min Stock: 50kg"].map((f, i) => (
          <motion.div key={f} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12, ease }}>
            <span className="text-cobalt">›</span> {f}
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    title: "Organize Across Locations",
    desc: "Transfer stock between Factory, Hubs, and customers with Move Orders — every unit tracked.",
    icon: ArrowRight,
    demo: (
      <div className="flex items-center gap-3 text-xs font-body">
        <span className="px-3 py-1.5 rounded-lg bg-cobalt/20 text-cobalt">Factory</span>
        <motion.div animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          <ArrowRight className="w-4 h-4 text-cobalt" />
        </motion.div>
        <span className="px-3 py-1.5 rounded-lg bg-cobalt/20 text-cobalt">Mumbai Hub</span>
        <motion.div animate={{ x: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}>
          <ArrowRight className="w-4 h-4 text-cobalt" />
        </motion.div>
        <span className="px-3 py-1.5 rounded-lg bg-cobalt/20 text-cobalt">Customer</span>
      </div>
    ),
  },
  {
    title: "Manage Manufacturing",
    desc: "BOM (Bill of Materials) tracks raw materials consumed per finished good. Pre & post-production visibility.",
    icon: Factory,
    demo: (
      <div className="space-y-2">
        <div className="text-xs font-body text-primary-foreground/80">BOM: Widget Pro</div>
        {[
          { name: "HDPE Granules", pct: 75 },
          { name: "Adhesive Labels", pct: 90 },
          { name: "Corrugated Box", pct: 60 },
        ].map((m) => (
          <div key={m.name} className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-primary-foreground/60">
              <span>{m.name}</span><span>{m.pct}%</span>
            </div>
            <div className="h-1.5 bg-primary-foreground/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-cobalt rounded-full" initial={{ width: 0 }} whileInView={{ width: `${m.pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8, ease }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Sales, Delivery & Documents",
    desc: "Generate Delivery Challans, Invoices, and track every sales order from draft to completion.",
    icon: FileCheck,
    demo: (
      <div className="space-y-2">
        {[
          "Delivery Challan #DC-2041 Generated ✓",
          "Sales Order SO-1892 Completed ✓",
          "Invoice PDF Downloaded ✓",
        ].map((n, i) => (
          <motion.div key={n} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.2, ease }}
            className="px-3 py-2 rounded-lg bg-cobalt/10 text-xs font-body text-cobalt"
          >{n}</motion.div>
        ))}
      </div>
    ),
  },
];

const HowItWorks = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-24 px-4 bg-dark-section noise-overlay relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />
      <div className="relative z-10 max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <span className="font-mono text-xs text-cobalt tracking-[0.2em] uppercase">How It Works</span>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-primary-foreground mt-3">
            Four steps to full control
          </h2>
        </AnimatedSection>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-primary-foreground/10">
            <motion.div
              className="w-full bg-cobalt origin-top"
              initial={{ height: 0 }}
              animate={isInView ? { height: "100%" } : {}}
              transition={{ duration: 2, ease }}
            />
          </div>

          {steps.map((step, i) => (
            <AnimatedSection
              key={step.title}
              delay={i * 0.15}
              direction={i % 2 === 0 ? "left" : "right"}
              className={`relative flex flex-col md:flex-row items-start gap-6 mb-16 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
            >
              {/* Node */}
              <div className="absolute left-6 md:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-cobalt border-4 border-navy z-10" style={{ top: 24 }} />

              {/* Content */}
              <div className={`ml-14 md:ml-0 md:w-1/2 ${i % 2 === 0 ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                <div className={`flex items-center gap-2 mb-2 ${i % 2 === 0 ? "md:justify-end" : ""}`}>
                  <step.icon className="w-5 h-5 text-cobalt" />
                  <span className="font-mono text-xs text-cobalt">Step {i + 1}</span>
                </div>
                <h3 className="font-heading font-bold text-xl text-primary-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-primary-foreground/50 font-body">{step.desc}</p>
              </div>

              {/* Demo */}
              <div className={`ml-14 md:ml-0 md:w-1/2 ${i % 2 === 0 ? "md:pl-12" : "md:pr-12"}`}>
                <div className="bg-dark-lighter rounded-xl p-4 border border-primary-foreground/5">
                  {step.demo}
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
