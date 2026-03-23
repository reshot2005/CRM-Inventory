import { motion } from "framer-motion";
import { Box, Linkedin, Twitter, Youtube } from "lucide-react";

const links = {
  Product: ["Features", "Pricing", "Integrations", "Changelog"],
  Resources: ["Docs", "API", "Blog", "Support"],
  Company: ["About", "Careers", "Contact", "Privacy"],
};

const Footer = () => (
  <footer className="bg-dark-section pt-16 pb-8 px-4 relative">
    <div className="absolute top-0 left-0 right-0 h-px" style={{
      background: "linear-gradient(90deg, transparent, hsl(217 91% 60%), transparent)",
    }} />
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Box className="w-6 h-6 text-cobalt" />
            <span className="font-heading font-extrabold text-lg text-primary-foreground">StockOS</span>
          </div>
          <p className="text-sm text-primary-foreground/50 font-body mb-6 max-w-xs">
            India's premium Inventory & Manufacturing Management System.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="email"
              placeholder="Get inventory tips & updates"
              className="bg-primary-foreground/5 border border-primary-foreground/10 rounded-full px-4 py-2.5 text-sm text-primary-foreground font-body placeholder:text-primary-foreground/30 focus:outline-none focus:border-cobalt/50 w-full max-w-[240px]"
            />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="shimmer-btn bg-cobalt text-primary-foreground px-5 py-2.5 rounded-full text-sm font-body font-semibold shrink-0"
            >
              Subscribe
            </motion.button>
          </div>
        </div>
        {Object.entries(links).map(([heading, items]) => (
          <div key={heading}>
            <h4 className="font-heading font-bold text-sm text-primary-foreground mb-4">{heading}</h4>
            <ul className="space-y-2.5">
              {items.map((item) => (
                <li key={item}>
                  <a href="#" className="text-sm text-primary-foreground/50 font-body hover:text-cobalt transition-colors duration-200">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-primary-foreground/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-primary-foreground/40 font-body">
          © 2025 StockOS. Built for Indian manufacturers & distributors.
        </p>
        <div className="flex items-center gap-3">
          {[Linkedin, Twitter, Youtube].map((Icon, i) => (
            <motion.a
              key={i}
              href="#"
              whileHover={{ scale: 1.15, rotate: 5 }}
              className="w-8 h-8 rounded-full bg-primary-foreground/5 flex items-center justify-center text-primary-foreground/50 hover:text-cobalt hover:bg-cobalt/10 transition-colors duration-200"
            >
              <Icon className="w-4 h-4" />
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
