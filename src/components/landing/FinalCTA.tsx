import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";

const FinalCTA = () => (
  <section className="py-24 px-4 gradient-cobalt relative overflow-hidden noise-overlay">
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary-foreground/5 blur-[80px] float-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-primary-foreground/5 blur-[60px] float-medium" />
      <div className="absolute top-1/2 right-1/3 w-56 h-56 rounded-full bg-primary-foreground/5 blur-[70px] float-fast" />
    </div>
    <div className="relative z-10 max-w-3xl mx-auto text-center">
      <AnimatedSection>
        <h2 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-primary-foreground leading-tight mb-6">
          Ready to take full control of your inventory?
        </h2>
        <p className="text-primary-foreground/70 text-lg font-body mb-8">
          Join 500+ businesses already running smarter with StockOS.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="bg-primary-foreground text-navy px-8 py-3.5 rounded-full font-body font-bold text-base shadow-lg hover:shadow-xl transition-shadow"
          >
            Start Free Trial
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="border border-primary-foreground/30 text-primary-foreground px-8 py-3.5 rounded-full font-body font-semibold text-base hover:bg-primary-foreground/10 transition-all duration-200"
          >
            Talk to Sales
          </motion.button>
        </div>
      </AnimatedSection>
    </div>
  </section>
);

export default FinalCTA;
