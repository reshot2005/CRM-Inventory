import AnimatedSection from "./AnimatedSection";
import NumberTicker from "./NumberTicker";

const stats = [
  { value: 500, suffix: "+", label: "Businesses" },
  { value: 50000, suffix: "+", label: "SKUs Tracked" },
  { value: 99, suffix: ".8%", label: "Stock Accuracy" },
  { value: 60, suffix: "%", label: "Faster Fulfillment" },
];

const Stats = () => (
  <section className="py-20 px-4 gradient-cobalt relative overflow-hidden noise-overlay">
    <div className="absolute inset-0 opacity-10" style={{
      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
      backgroundSize: "40px 40px",
    }} />
    <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
      {stats.map((s, i) => (
        <AnimatedSection key={s.label} delay={i * 0.1} className="text-center">
          <div className="text-4xl md:text-5xl font-heading font-extrabold text-primary-foreground">
            <NumberTicker value={s.value} suffix={s.suffix} />
          </div>
          <p className="text-sm text-primary-foreground/70 font-body mt-2">{s.label}</p>
        </AnimatedSection>
      ))}
    </div>
  </section>
);

export default Stats;
