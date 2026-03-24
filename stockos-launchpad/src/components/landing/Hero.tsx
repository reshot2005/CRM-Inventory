import { motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import NumberTicker from "./NumberTicker";

const ease = [0.16, 1, 0.3, 1] as const;

const HeroDashboard = () => (
  <div className="bg-navy rounded-2xl p-5 text-primary-foreground w-full max-w-2xl shadow-hero">
    <div className="flex items-center justify-between mb-4">
      <span className="font-heading font-bold text-sm">StockOS Dashboard</span>
      <span className="font-mono text-xs text-cobalt">Live · 3 Warehouses</span>
    </div>
    <div className="grid grid-cols-4 gap-3 mb-4">
      {[
        { label: "Total SKUs", value: "1,247", change: "+12%" },
        { label: "Low Stock", value: "18", change: "-3" },
        { label: "Out of Stock", value: "2", change: "↓" },
        { label: "Move Orders", value: "34", change: "+8" },
      ].map((s) => (
        <div key={s.label} className="bg-dark-lighter rounded-xl p-3">
          <p className="text-xs text-light-muted font-body">{s.label}</p>
          <p className="text-lg font-heading font-bold">{s.value}</p>
          <span className="text-xs text-cobalt">{s.change}</span>
        </div>
      ))}
    </div>
    <div className="bg-dark-lighter rounded-xl p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-light-muted text-left">
            <th className="pb-2 font-body font-medium">Item</th>
            <th className="pb-2 font-body font-medium">Code</th>
            <th className="pb-2 font-body font-medium">Qty</th>
            <th className="pb-2 font-body font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {[
            { item: "HDPE Granules", code: "RM-0412", qty: "12 kg", status: "Low", color: "text-red-400" },
            { item: "Corrugated Box A", code: "PM-0088", qty: "340", status: "OK", color: "text-green-400" },
            { item: "Adhesive Label 100x50", code: "PM-0124", qty: "200", status: "Low", color: "text-red-400" },
            { item: "Finished Widget Pro", code: "FG-1001", qty: "89", status: "OK", color: "text-green-400" },
          ].map((r) => (
            <tr key={r.code} className="border-t border-muted/10">
              <td className="py-1.5 font-body">{r.item}</td>
              <td className="py-1.5">{r.code}</td>
              <td className="py-1.5">{r.qty}</td>
              <td className={`py-1.5 ${r.color}`}>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const Hero = () => {
  return (
    <section className="relative min-h-screen gradient-dark noise-overlay overflow-hidden flex flex-col items-center justify-center px-4 pt-24 pb-16">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-cobalt/10 blur-[120px] float-slow" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-premium/10 blur-[100px] float-medium" />
        <div className="absolute bottom-1/4 left-1/2 w-80 h-80 rounded-full bg-cobalt-deep/10 blur-[100px] float-fast" />
        {/* Dot pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{
            background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(245,158,11,0.15))",
            border: "1px solid rgba(37,99,235,0.3)",
          }}
        >
          <span className="text-sm font-body text-primary-foreground/90">
            ⚡ Now with AI Smart Search · Real-Time Stock Intelligence
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease }}
          className="font-heading font-extrabold text-4xl sm:text-5xl md:text-7xl text-primary-foreground leading-[1.05] mb-6"
        >
          Your Inventory.{" "}
          <br className="hidden sm:block" />
          Fully <span className="text-cobalt">Under Control.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease }}
          className="text-primary-foreground/60 text-base sm:text-lg max-w-2xl mx-auto mb-8 font-body"
        >
          StockOS unifies raw materials, manufacturing, finished goods, vendors,
          and sales — so every team member tracks every unit, from warehouse to
          delivery.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.36, ease }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="shimmer-btn bg-cobalt text-primary-foreground px-8 py-3.5 rounded-full font-body font-semibold text-base"
          >
            Start Free Trial →
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03, backgroundColor: "rgba(255,255,255,1)", color: "hsl(222,47%,11%)" }}
            whileTap={{ scale: 0.97 }}
            className="border border-primary-foreground/30 text-primary-foreground px-8 py-3.5 rounded-full font-body font-semibold text-base transition-all duration-200"
          >
            Watch 2-min Demo
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.48, ease }}
          className="flex items-center justify-center gap-6 text-primary-foreground/50 text-sm font-body mb-12"
        >
          {["Free 14 days", "No card required", "Setup in 10 mins"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-cobalt" /> {t}
            </span>
          ))}
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease }}
          className="relative"
        >
          <div className="float-slow">
            <HeroDashboard />
          </div>
          {/* Mini cards */}
          <motion.div
            className="absolute -top-4 -left-4 sm:left-8 bg-navy rounded-xl px-4 py-2.5 shadow-lg float-medium border border-primary-foreground/10"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, duration: 0.7, ease }}
          >
            <span className="text-xs text-light-muted font-body">SKUs Tracked</span>
            <p className="text-lg font-heading font-bold text-primary-foreground">
              <NumberTicker value={1247} />
            </p>
          </motion.div>
          <motion.div
            className="absolute -top-4 -right-4 sm:right-8 bg-cobalt rounded-xl px-4 py-2.5 shadow-lg float-fast"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9, duration: 0.7, ease }}
          >
            <span className="text-xs text-primary-foreground/80 font-body">AI Ready</span>
            <p className="text-sm font-heading font-bold text-primary-foreground">Enabled ✓</p>
          </motion.div>
          <motion.div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-navy rounded-xl px-4 py-2.5 shadow-lg float-medium border border-primary-foreground/10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.7, ease }}
          >
            <span className="text-xs text-light-muted font-body">Warehouses</span>
            <p className="text-lg font-heading font-bold text-primary-foreground">
              <NumberTicker value={3} />
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-primary-foreground/40"
      >
        <span className="text-xs font-body">Scroll to explore</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <ChevronDown className="w-5 h-5" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default Hero;
