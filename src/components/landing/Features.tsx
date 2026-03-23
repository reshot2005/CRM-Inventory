import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import AnimatedSection from "./AnimatedSection";
import NumberTicker from "./NumberTicker";
import { Bot, MapPin, Shield, FileText, Upload, Zap } from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const AIChat = () => {
  const [step, setStep] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 1800);
    const t3 = setTimeout(() => setStep(3), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isInView]);

  return (
    <div ref={ref} className="bg-navy rounded-xl p-4 h-full flex flex-col justify-end gap-3 text-sm min-h-[240px]">
      {step >= 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-end bg-cobalt/20 text-primary-foreground/90 rounded-xl rounded-br-sm px-3 py-2 max-w-[85%] font-body">
          Which raw materials are below minimum stock level?
        </motion.div>
      )}
      {step >= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-cobalt text-xs font-body">
          <span className="w-2 h-2 rounded-full bg-cobalt pulse-soft" /> AI Thinking...
        </motion.div>
      )}
      {step >= 3 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start bg-dark-lighter text-primary-foreground/80 rounded-xl rounded-bl-sm px-3 py-2 max-w-[90%] font-body text-xs">
          <p className="font-semibold mb-1">3 items found:</p>
          <p>• HDPE Granules — 12kg (min: 50kg)</p>
          <p>• Corrugated Sheet B — 8 units (min: 100)</p>
          <p>• Adhesive Labels — 200 (min: 1000)</p>
          <p className="text-cobalt mt-2 text-[10px] font-mono">Live Inventory · Updated 2 min ago</p>
        </motion.div>
      )}
    </div>
  );
};

const WarehouseTree = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const locations = [
    { name: "Factory Hub", level: 92 },
    { name: "Mumbai Hub", level: 78 },
    { name: "Delhi Hub", level: 65 },
    { name: "Pune Hub", level: 45 },
  ];
  return (
    <div ref={ref} className="space-y-3 p-4">
      {locations.map((loc, i) => (
        <motion.div
          key={loc.name}
          initial={{ opacity: 0, x: -20 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: i * 0.15, duration: 0.5, ease }}
          className="flex items-center gap-3"
        >
          <MapPin className="w-4 h-4 text-cobalt shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-body text-foreground">{loc.name}</span>
              <span className="font-mono text-muted-foreground">{loc.level}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className="h-full gradient-cobalt rounded-full"
                initial={{ width: 0 }}
                animate={isInView ? { width: `${loc.level}%` } : {}}
                transition={{ delay: i * 0.15 + 0.3, duration: 0.8, ease }}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const cards = [
  {
    title: "AI Inventory Assistant",
    icon: Bot,
    span: "md:col-span-2",
    dark: true,
    content: <AIChat />,
  },
  {
    title: "Multi-Location Stock Tracking",
    icon: MapPin,
    span: "md:row-span-2",
    content: <WarehouseTree />,
  },
  {
    title: "Role-Based Access Control",
    icon: Shield,
    content: (
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full bg-cobalt/10 text-cobalt text-xs font-body font-semibold">Admin</span>
          <span className="px-3 py-1 rounded-full bg-premium/10 text-premium text-xs font-body font-semibold">Approval-Based</span>
        </div>
        <p className="text-xs text-muted-foreground font-body">Admin approves new user accounts with granular module access.</p>
        <div className="flex items-center gap-2 text-xs font-mono text-cobalt">
          <Shield className="w-3 h-3" /> Secure by default
        </div>
      </div>
    ),
  },
  {
    title: "Stock Ledger & Reports",
    icon: FileText,
    content: (
      <div className="p-4 space-y-1.5 font-mono text-xs">
        {[
          { type: "+IN", item: "HDPE Granules", qty: "+500kg", bal: "512kg" },
          { type: "-OUT", item: "Widget Pro", qty: "-20", bal: "69" },
          { type: "+IN", item: "Labels 100x50", qty: "+2000", bal: "2200" },
        ].map((e, i) => (
          <div key={i} className={`flex justify-between py-1 ${e.type === "+IN" ? "text-green-500" : "text-red-400"}`}>
            <span className="w-10">{e.type}</span>
            <span className="flex-1 text-foreground font-body">{e.item}</span>
            <span className="w-16 text-right">{e.qty}</span>
            <span className="w-16 text-right text-muted-foreground">{e.bal}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Upload Any Document",
    icon: Upload,
    content: (
      <div className="p-4 flex flex-wrap gap-2">
        {["PDF Invoice", "JPG Photo", "Bill PNG", "Challan PDF"].map((f) => (
          <span key={f} className="px-3 py-1.5 rounded-lg bg-secondary text-xs font-body text-foreground">{f}</span>
        ))}
        <p className="text-xs text-muted-foreground font-body mt-2 w-full">Cloud Stored · Always Accessible</p>
      </div>
    ),
  },
  {
    title: "60% Faster Fulfillment",
    icon: Zap,
    content: (
      <div className="p-4 flex flex-col items-center justify-center">
        <span className="text-4xl font-heading font-extrabold text-cobalt">
          <NumberTicker value={60} suffix="%" />
        </span>
        <span className="text-xs text-muted-foreground font-body mt-1">vs manual tracking</span>
      </div>
    ),
  },
];

const Features = () => (
  <section id="features" className="py-24 px-4 bg-primary-section">
    <div className="max-w-6xl mx-auto">
      <AnimatedSection className="text-center mb-16">
        <span className="font-mono text-xs text-cobalt tracking-[0.2em] uppercase">Features</span>
        <h2 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-foreground mt-3">
          Complete inventory control.
          <br />
          <span className="text-muted-foreground">From raw material to dispatch.</span>
        </h2>
      </AnimatedSection>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <AnimatedSection key={card.title} delay={i * 0.08} className={`${card.span || ""}`}>
            <motion.div
              whileHover={{ y: -4 }}
              className={`rounded-2xl border overflow-hidden h-full transition-shadow duration-300 hover:shadow-lg ${card.dark ? "bg-navy border-primary-foreground/10" : "bg-card border-border"}`}
            >
              <div className={`px-5 pt-5 pb-2 flex items-center gap-2 ${card.dark ? "text-primary-foreground" : "text-foreground"}`}>
                <card.icon className="w-5 h-5 text-cobalt" />
                <h3 className="font-heading font-bold text-sm">{card.title}</h3>
              </div>
              {card.content}
            </motion.div>
          </AnimatedSection>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
