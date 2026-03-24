import { useState } from "react";
import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import NumberTicker from "./NumberTicker";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Starter",
    monthlyPrice: 2999,
    yearlyPrice: 2399,
    features: ["1 Location", "Up to 500 SKUs", "2 Users", "Inventory + Sales", "PDF Generator", "Email Support"],
  },
  {
    name: "Growth",
    monthlyPrice: 6999,
    yearlyPrice: 5599,
    popular: true,
    features: ["3 Locations", "Up to 5,000 SKUs", "10 Users", "All Starter + Manufacturing", "CRM · Vendor Management", "AI Assistant", "Priority Support"],
  },
  {
    name: "Enterprise",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ["Unlimited Locations", "Unlimited SKUs", "Unlimited Users", "All Modules", "API Access", "Custom Integrations", "Dedicated Account Manager"],
  },
];

const Pricing = () => {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-24 px-4 bg-dark-section noise-overlay relative overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-12">
          <span className="font-mono text-xs text-cobalt tracking-[0.2em] uppercase">Pricing</span>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-primary-foreground mt-3">
            Simple, transparent pricing
          </h2>
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className={`text-sm font-body ${!yearly ? "text-primary-foreground" : "text-primary-foreground/40"}`}>Monthly</span>
            <button
              onClick={() => setYearly(!yearly)}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${yearly ? "bg-cobalt" : "bg-primary-foreground/20"}`}
            >
              <motion.div
                className="w-5 h-5 rounded-full bg-primary-foreground absolute top-0.5"
                animate={{ left: yearly ? 26 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
            <span className={`text-sm font-body ${yearly ? "text-primary-foreground" : "text-primary-foreground/40"}`}>
              Yearly <span className="text-cobalt text-xs">Save 20%</span>
            </span>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <AnimatedSection key={plan.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -8 }}
                className={`relative rounded-2xl p-6 h-full glass-dark transition-all duration-300 hover:border-cobalt/40 ${
                  plan.popular ? "border-cobalt/40 glow-cobalt" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-premium text-navy text-xs font-heading font-bold">
                    Most Popular
                  </span>
                )}
                <h3 className="font-heading font-bold text-xl text-primary-foreground mb-1">{plan.name}</h3>
                <div className="mb-6">
                  {plan.monthlyPrice > 0 ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-heading font-extrabold text-primary-foreground">
                        ₹<NumberTicker value={yearly ? plan.yearlyPrice : plan.monthlyPrice} duration={600} />
                      </span>
                      <span className="text-sm text-primary-foreground/50 font-body">/mo</span>
                    </div>
                  ) : (
                    <span className="text-2xl font-heading font-extrabold text-primary-foreground">Custom</span>
                  )}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, fi) => (
                    <motion.li
                      key={f}
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: fi * 0.05 }}
                      className="flex items-center gap-2 text-sm text-primary-foreground/70 font-body"
                    >
                      <Check className="w-4 h-4 text-cobalt shrink-0" /> {f}
                    </motion.li>
                  ))}
                </ul>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full py-3 rounded-full text-sm font-body font-semibold transition-all duration-200 ${
                    plan.popular
                      ? "shimmer-btn bg-cobalt text-primary-foreground"
                      : "border border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                  }`}
                >
                  {plan.monthlyPrice > 0 ? "Start Free Trial" : "Talk to Sales"}
                </motion.button>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
