import { motion } from "framer-motion";
import Marquee from "./Marquee";
import AnimatedSection from "./AnimatedSection";
import { Star } from "lucide-react";

const testimonials = [
  { name: "Ramesh K.", role: "Ops Head", company: "RetailChain India", quote: "StockOS replaced our 6 Excel sheets. We now know exact stock across 3 warehouses in real time." },
  { name: "Priya M.", role: "Factory Manager", company: "ManufacturePro", quote: "The AI assistant found our critical stockout before we even noticed. Saved us a ₹4L production delay." },
  { name: "Suresh P.", role: "Logistics Lead", company: "DistributEx", quote: "Delivery Challan generation alone saved us 2 hours per day." },
  { name: "Anita D.", role: "Supply Chain Dir.", company: "PackRight", quote: "Multi-location tracking gave us visibility we never had. Overstock dropped 40% in month one." },
  { name: "Vikram S.", role: "CEO", company: "QuickStock", quote: "Our team adopted StockOS in 2 days. The UI is that intuitive. Zero training needed." },
  { name: "Meera R.", role: "Procurement Head", company: "FactoryEdge", quote: "Vendor management + material linkage is genius. We finally know exactly who supplies what." },
];

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
  <motion.div
    whileHover={{ y: -8 }}
    className="w-80 shrink-0 bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-lg transition-shadow duration-300"
  >
    <div className="flex gap-0.5 mb-3">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="w-4 h-4 fill-premium text-premium" />
      ))}
    </div>
    <p className="text-sm text-foreground font-body leading-relaxed mb-4">"{t.quote}"</p>
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full gradient-cobalt flex items-center justify-center text-primary-foreground font-heading font-bold text-sm">
        {t.name[0]}
      </div>
      <div>
        <p className="text-sm font-heading font-bold text-foreground">{t.name}</p>
        <p className="text-xs text-muted-foreground font-body">{t.role}, {t.company}</p>
      </div>
    </div>
  </motion.div>
);

const Testimonials = () => (
  <section className="py-24 px-4 bg-primary-section overflow-hidden">
    <AnimatedSection className="text-center mb-12 max-w-3xl mx-auto">
      <span className="font-mono text-xs text-cobalt tracking-[0.2em] uppercase">Testimonials</span>
      <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-foreground mt-3">
        Loved by Indian manufacturers & distributors
      </h2>
    </AnimatedSection>
    <div className="space-y-4" style={{ perspective: "1200px" }}>
      <div style={{ transform: "rotateX(4deg)" }}>
        <Marquee speed={60}>
          <div className="flex gap-4">
            {testimonials.slice(0, 3).map((t) => <TestimonialCard key={t.name} t={t} />)}
          </div>
        </Marquee>
      </div>
      <div style={{ transform: "rotateX(4deg)" }}>
        <Marquee speed={55} reverse>
          <div className="flex gap-4">
            {testimonials.slice(3).map((t) => <TestimonialCard key={t.name} t={t} />)}
          </div>
        </Marquee>
      </div>
    </div>
  </section>
);

export default Testimonials;
