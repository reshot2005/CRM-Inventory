import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, X, Send, MessageCircle } from "lucide-react";

export default function AIChatWidget() {
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessage, setChatMessage] = useState("");

  return (
    <>
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 w-80 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
                <span className="text-sm font-semibold text-[#0F172A]">AI Inventory Chat</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="p-1 text-[#64748B] hover:text-[#0F172A]"><MoreHorizontal size={16} /></button>
                <button type="button" onClick={() => setChatOpen(false)} className="p-1 text-[#64748B] hover:text-[#0F172A]"><X size={16} /></button>
              </div>
            </div>
            <div className="h-64 space-y-4 overflow-y-auto p-4">
              <div className="rounded-xl bg-[#E3EBFF] px-3 py-2 text-sm text-[#0F172A]">Which items are below minimum stock level?</div>
              <div className="space-y-2">
                <div className="rounded-xl bg-[#1E2B4A] px-3 py-2 text-sm text-white">
                  3 critical items found:<br />
                  HDPE Granules ? 143kg (min: 500kg) ??<br />
                  Corrugated Sheet B ? 8 units (min: 100) ??<br />
                  Adhesive Labels ? 200 pcs (min: 1000) ??
                </div>
                <div className="flex gap-2">
                  <motion.div className="rounded-lg bg-[#E0ECFF] px-2 py-1 text-xs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>?? Live Inventory · Updated 2 min ago</motion.div>
                  <motion.div className="rounded-lg bg-[#E0ECFF] px-2 py-1 text-xs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>?? Low Stock Report · 3 items</motion.div>
                </div>
              </div>
            </div>
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              <div className="flex items-center gap-2 rounded-xl bg-[#E3EBFF] px-3 py-2">
                <input
                  type="text"
                  placeholder="Ask about stock, vendors, orders..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#64748B]"
                />
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2563EB] text-white hover:bg-[#1D4ED8]"><Send size={14} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!chatOpen && (
        <motion.button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <MessageCircle className="h-6 w-6" />
        </motion.button>
      )}
    </>
  );
}
