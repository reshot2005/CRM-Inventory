import Marquee from "./Marquee";
import AnimatedSection from "./AnimatedSection";

const companies = ["RetailChain India", "ManufacturePro", "DistributEx", "PackRight", "WarehouseX", "QuickStock", "FactoryEdge", "LogiOps"];
const stats = ["500+ Businesses", "50,000+ SKUs Managed", "99.8% Stock Accuracy", "60% Faster Fulfillment", "₹18L+ Saved"];

const Diamond = () => <span className="text-cobalt mx-4">◆</span>;

const SocialProof = () => (
  <section className="relative py-16 gradient-dark overflow-hidden">
    <AnimatedSection>
      <Marquee speed={50} className="mb-4">
        <div className="flex items-center">
          {companies.map((c) => (
            <span key={c} className="flex items-center">
              <span className="text-primary-foreground/70 font-heading font-bold text-lg whitespace-nowrap hover:text-primary-foreground hover:scale-110 transition-all duration-200 cursor-default px-2">{c}</span>
              <Diamond />
            </span>
          ))}
        </div>
      </Marquee>
      <Marquee speed={45} reverse className="opacity-70">
        <div className="flex items-center">
          {stats.map((s) => (
            <span key={s} className="flex items-center">
              <span className="text-cobalt font-body font-semibold text-sm whitespace-nowrap px-2">{s}</span>
              <Diamond />
            </span>
          ))}
        </div>
      </Marquee>
    </AnimatedSection>
  </section>
);

export default SocialProof;
