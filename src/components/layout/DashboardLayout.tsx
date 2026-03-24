import { Menu, Bell, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F6F8FB]">
      <Sidebar />

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <motion.div className="absolute left-0 top-0 h-full w-[88%] max-w-[320px]" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}>
              <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex-1 md:ml-[250px]">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#E2E8F0] bg-[#F6F8FB]/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-[#E2E8F0] md:hidden">
              <Menu className="h-5 w-5 text-[#1E2B4A]" />
            </button>
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden>
              <rect x="8" y="16" width="32" height="22" rx="4" fill="#2563EB" />
              <path d="M14 16V12C14 10.89 14.89 10 16 10H32C33.11 10 34 10.89 34 12V16" stroke="#5FA8FF" strokeWidth="2" fill="none" />
            </svg>
            <h1 className="text-base text-[#1E2B4A] sm:text-lg"><span className="font-bold">Inventory</span> Management System</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input type="search" placeholder="Search..." className="w-[200px] rounded-xl bg-[#E0ECFF] py-2.5 pl-10 pr-4 text-sm text-[#1E2B4A] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30" />
            </div>
            <button type="button" className="relative rounded-lg p-2 hover:bg-[#E0ECFF]"><Bell className="h-5 w-5 text-[#1E2B4A]" /><span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#2563EB]" /></button>
            <button type="button" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#E0ECFF]">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-[#2563EB]"><img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" alt="Admin" className="h-full w-full object-cover" /></div>
              <span className="hidden text-sm font-medium text-[#1E2B4A] sm:inline">Admin</span>
              <ChevronDown className="h-4 w-4 text-[#64748B]" />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
