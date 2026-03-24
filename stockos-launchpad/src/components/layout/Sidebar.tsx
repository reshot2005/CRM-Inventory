import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Cog,
  Factory,
  FileText,
  Home,
  LayoutGrid,
  MapPin,
  Package,
  PackageCheck,
  Receipt,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Warehouse,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

interface NavItem { name: string; href: string; Icon: ComponentType<{ size?: number; className?: string }>; }
interface NavGroup { key: string; label: string; Icon: ComponentType<{ size?: number; className?: string }>; items?: NavItem[]; href?: string; }

const groups: NavGroup[] = [
  { key: "dashboard", label: "Dashboard", Icon: Home, href: "/dashboard" },
  { key: "inventory", label: "Inventory", Icon: Package, items: [
    { name: "Products & SKUs", href: "/dashboard/products", Icon: LayoutGrid },
    { name: "Raw Materials", href: "/dashboard/raw-materials", Icon: Boxes },
    { name: "Finished Goods", href: "/dashboard/finished-goods", Icon: CheckSquare },
    { name: "Packaging Materials", href: "/dashboard/packaging", Icon: Archive },
  ]},
  { key: "warehouses", label: "Warehouses", Icon: Warehouse, items: [
    { name: "All Locations", href: "/dashboard/locations", Icon: MapPin },
    { name: "Stock Transfers", href: "/dashboard/transfers", Icon: ArrowLeftRight },
    { name: "Stock Adjustments", href: "/dashboard/adjustments", Icon: SlidersHorizontal },
  ]},
  { key: "purchases", label: "Purchases", Icon: ShoppingCart, items: [
    { name: "Purchase Orders", href: "/dashboard/purchase-orders", Icon: FileText },
    { name: "Vendors", href: "/dashboard/vendors", Icon: Users },
    { name: "Receive Stock", href: "/dashboard/receive", Icon: PackageCheck },
  ]},
  { key: "sales", label: "Sales", Icon: TrendingUp, items: [
    { name: "Sales Orders", href: "/dashboard/sales-orders", Icon: Receipt },
    { name: "Customers", href: "/dashboard/customers", Icon: UserCheck },
    { name: "Delivery Challans", href: "/dashboard/challans", Icon: Truck },
  ]},
  { key: "manufacturing", label: "Manufacturing", Icon: Factory, items: [
    { name: "Production Orders", href: "/dashboard/production", Icon: Cog },
    { name: "Bills of Materials", href: "/dashboard/bom", Icon: ClipboardList },
  ]},
  { key: "reports", label: "Reports", Icon: BarChart3, href: "/dashboard/reports" },
];

export default function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void; }) {
  const { pathname } = useLocation();
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({ inventory: true });

  const computedMap = useMemo(() => ({ ...openMap }), [openMap]);

  return (
    <aside className={`${mobile ? "w-full" : "hidden md:flex w-[250px]"} flex h-full flex-col bg-[#1E2B4A]`}>
      <div className="flex items-center gap-2 px-5 py-5">
        <BrandLogo className="h-8 w-8" />
        <span className="text-xl font-bold tracking-tight text-white">StockOS</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {groups.map((group) => {
          if (group.href) {
            const active = pathname === group.href;
            return (
              <Link key={group.key} to={group.href} onClick={onNavigate}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${active ? "bg-[#2563EB] text-white" : "text-[#C7D2FE] hover:bg-[#273861] hover:text-white"}`}>
                {active ? <motion.div layoutId="activeIndicator" className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#2563EB]" /> : null}
                <group.Icon size={18} /> {group.label}
              </Link>
            );
          }
          const open = Boolean(computedMap[group.key]);
          return (
            <div key={group.key}>
              <button type="button" onClick={() => setOpenMap((p) => ({ ...p, [group.key]: !open }))}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-[#C7D2FE] transition hover:bg-[#273861] hover:text-white">
                <span className="flex items-center gap-3"><group.Icon size={18} />{group.label}</span>
                <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {open ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="space-y-0.5 py-1 pl-4">
                      {(group.items ?? []).map((item) => {
                        const active = pathname === item.href;
                        return (
                          <Link key={item.href} to={item.href} onClick={onNavigate}
                            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-[#2563EB] text-white" : "text-[#C7D2FE] hover:bg-[#273861] hover:text-white"}`}>
                            {active ? <motion.div layoutId="activeIndicator" className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#2563EB]" /> : null}
                            <item.Icon size={16} /> {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
