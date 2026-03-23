import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Box } from "lucide-react";

const navLinks = ["Dashboard", "Features", "Pricing", "Integrations", "Docs"];

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl"
    >
      <motion.div
        animate={{ scale: scrolled ? 0.97 : 1 }}
        transition={{ duration: 0.3 }}
        className={`glass-nav rounded-full px-6 py-3 flex items-center justify-between ${scrolled ? "shadow-lg" : ""}`}
      >
        <a href="#" className="flex items-center gap-2 group">
          <motion.div whileHover={{ rotate: 12 }} transition={{ type: "spring", stiffness: 300 }}>
            <Box className="w-6 h-6 text-cobalt" />
          </motion.div>
          <span className="font-heading font-extrabold text-lg text-foreground">StockOS</span>
        </a>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm font-body text-muted-foreground hover:text-cobalt transition-colors duration-200 relative group"
            >
              {link}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-cobalt transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden md:block">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="shimmer-btn bg-cobalt text-primary-foreground px-5 py-2 rounded-full text-sm font-body font-semibold"
          >
            Get Started
          </motion.button>
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass-nav rounded-2xl mt-2 p-4 flex flex-col gap-3"
          >
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-sm font-body text-foreground hover:text-cobalt px-3 py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link}
              </a>
            ))}
            <button className="shimmer-btn bg-cobalt text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold mt-1">
              Get Started
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
