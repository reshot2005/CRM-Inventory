import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { UserRound } from "lucide-react";

type ModuleId =
  | "inventory"
  | "manufacturing"
  | "purchasing"
  | "warehousing"
  | "orders";

type ModuleData = {
  id: ModuleId;
  tab: string;
  eyebrow: string;
  title: string;
  body: string;
  chips: string[];
  bg: string;
  previewTint: string;
  personLabel: string;
};

const modules: ModuleData[] = [
  {
    id: "inventory",
    tab: "Inventory Management",
    eyebrow: "INVENTORY MANAGEMENT",
    title: "Take control of your inventory in real time",
    body: "StockOS gives you live, connected stock visibility across all your locations - Factory, Hubs, and warehouses. Track every raw material, finished good, and packaging item with real-time accuracy and minimum stock alerts.",
    chips: [
      "Real-time stock visibility",
      "Automated stock movements",
      "Multi-location support (Factory + Hubs)",
      "Minimum stock level alerts",
      "Product Code & SKU tracking",
      "Monthly ledger reports",
      "Low stock notifications",
      "Packaging material tracking",
    ],
    bg: "#F6F8FB",
    previewTint: "#EFF6FF",
    personLabel: "Business Analyst",
  },
  {
    id: "manufacturing",
    tab: "Manufacturing",
    eyebrow: "MANUFACTURING",
    title: "Manufacturing you can see, control, and deliver",
    body: "Get complete visibility into your entire production process. Define Bills of Materials, track raw material consumption, and monitor every production order from planned to completed - with live shop floor updates.",
    chips: [
      "Bill of Materials (BOM)",
      "Pre & post-production tracking",
      "Production order management",
      "Raw material consumption tracking",
      "Finished goods yield tracking",
      "Packaging material usage",
      "Production cost calculations",
      "MTO and MTS workflows",
    ],
    bg: "#FFFBF0",
    previewTint: "#FEF3C7",
    personLabel: "Shop Floor Lead",
  },
  {
    id: "purchasing",
    tab: "Purchasing",
    eyebrow: "PURCHASING & VENDOR MANAGEMENT",
    title: "Stay ahead with demand-led purchasing",
    body: "Track everything purchased and trace its journey from supplier to production floor. Maintain complete vendor profiles with GSTIN, payment terms, multiple POCs, and material linkages - so you always know who supplies what.",
    chips: [
      "Vendor ID & GSTIN tracking",
      "Multiple POC per vendor",
      "Raw material linkage to vendors",
      "Purchase order management",
      "Partial receiving support",
      "Document attachment (contracts, certificates)",
      "Payment terms tracking",
      "Smart reorder recommendations",
    ],
    bg: "#FFF5F5",
    previewTint: "#FCE7F3",
    personLabel: "Procurement Manager",
  },
  {
    id: "warehousing",
    tab: "Warehousing",
    eyebrow: "WAREHOUSING & STOCK MOVEMENTS",
    title: "Reliably move stock in and out of locations",
    body: "Create Move Orders between Factory and Hubs with full traceability. Every stock transfer - whether a sale dispatch or inter-location transfer - is tracked, logged, and accessible in your stock ledger instantly.",
    chips: [
      "Move Order creation (Sale / Transfer)",
      "Factory -> Hub stock transfers",
      "Pick and pack workflows",
      "Stock ledger for all movements",
      "Receiving confirmation",
      "Barcode-ready item tracking",
      "Multi-location stock balances",
      "Real-time movement status",
    ],
    bg: "#F0FFF4",
    previewTint: "#DCFCE7",
    personLabel: "Warehouse Supervisor",
  },
  {
    id: "orders",
    tab: "Order Management",
    eyebrow: "SALES & ORDER MANAGEMENT",
    title: "Manage orders and documents across all your channels",
    body: "Handle sales orders, generate Delivery Challans, and store all invoices, bills, and photos in the cloud automatically. Every order is tracked from creation to dispatch, with PDF documents downloadable at any step.",
    chips: [
      "Sales order creation & tracking",
      "Delivery Challan PDF generator",
      "Cloud document storage (Invoices, Bills, Photos)",
      "Customer profiles (Individual / Business)",
      "Multiple contacts per customer",
      "GMaps location per customer",
      "Customer activity log",
      "Admin approval workflow for new users",
    ],
    bg: "#F5F3FF",
    previewTint: "#EDE9FE",
    personLabel: "Sales Coordinator",
  },
];

const panelEase: [number, number, number, number] = [0.19, 1, 0.22, 1];

const statusDot = (tone: "green" | "amber" | "red" | "slate") => {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-400";
  if (tone === "red") return "bg-red-500";
  return "bg-slate-300";
};

const PersonPlaceholder = ({ label, tint }: { label: string; tint: string }) => (
  <div
    className="w-[190px] sm:w-[220px] md:w-[250px] rounded-2xl border border-white/60 p-4 shadow-xl"
    style={{
      background: `linear-gradient(135deg, ${tint}, #dbeafe)`,
    }}
  >
    <div className="h-[220px] rounded-xl bg-white/40 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
      <div className="h-14 w-14 rounded-full bg-white/70 text-cobalt flex items-center justify-center">
        <UserRound className="h-7 w-7" />
      </div>
      <p className="text-[11px] font-body font-semibold text-slate-700 uppercase tracking-[0.08em]">
        {label}
      </p>
    </div>
  </div>
);

const TinyPreview = ({ tint }: { tint: string }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-2">
    <div className="rounded-md p-2" style={{ backgroundColor: tint }}>
      <div className="h-1.5 w-3/5 rounded bg-slate-300/80" />
      <div className="mt-2 grid grid-cols-3 gap-1">
        <div className="h-6 rounded bg-white/90" />
        <div className="h-6 rounded bg-white/80" />
        <div className="h-6 rounded bg-white/70" />
      </div>
    </div>
  </div>
);

const InventoryMockup = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-3 flex items-center justify-between text-[11px] font-medium text-slate-500">
      <span>Item Name</span>
      <span>Product Code</span>
      <span>Stock</span>
      <span>Committed</span>
      <span>Expected</span>
      <span>Min Level</span>
    </div>
    <div className="space-y-2 text-xs">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">Nylon Resin [RAW-022]</div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <div className="grid grid-cols-6 gap-2 text-slate-900">
          <span className="col-span-2">HDPE Granules [RAW-001]</span>
          <span>143</span>
          <span>16</span>
          <span>4</span>
          <span className="font-semibold text-red-600">50</span>
        </div>
        <span className="mt-1 inline-flex rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Low Stock</span>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">PET Flakes [RAW-019]</div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-medium">
      <div className="rounded-md bg-slate-100 p-2 text-slate-600">Raw Materials</div>
      <div className="rounded-md bg-slate-100 p-2 text-slate-600">Finished Goods</div>
      <div className="rounded-md bg-slate-100 p-2 text-slate-600">Packaging</div>
    </div>
  </div>
);

const ManufacturingMockup = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-3 grid grid-cols-5 gap-2 text-[11px] font-medium text-slate-500">
      <span>Rank</span>
      <span>Task / Order</span>
      <span>Deadline</span>
      <span>Materials</span>
      <span>Status</span>
    </div>
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
      <div className="grid grid-cols-5 gap-2">
        <span>3</span>
        <span>MO-122</span>
        <span>02-02-25</span>
        <span>In Stock</span>
        <span className="font-semibold text-amber-700">In Progress</span>
      </div>
    </div>
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-semibold">Task</p>
      <p className="mt-2">[RAW-001] HDPE Granules / Natural</p>
      <p className="text-slate-500">50 kg - PO-125 - Factory Floor</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        {["Not Started", "In Progress", "Paused", "Completed", "Blocked"].map((label) => (
          <span key={label} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(
              label === "Completed"
                ? "green"
                : label === "In Progress"
                ? "amber"
                : label === "Blocked"
                ? "red"
                : "slate"
            )}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const PurchasingMockup = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="mb-3 grid grid-cols-6 gap-2 text-[11px] font-medium text-slate-500">
      <span>Product</span>
      <span>Stock</span>
      <span>Committed</span>
      <span>Expected</span>
      <span>Safety</span>
      <span>Action</span>
    </div>
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <div className="grid grid-cols-6 gap-2">
        <span>Aloe Vera gel</span>
        <span>435ml</span>
        <span className="text-red-600 font-semibold">0ml</span>
        <span>1500ml</span>
        <span className="text-red-600 font-semibold">0ml</span>
        <button className="rounded bg-emerald-600 px-2 py-0.5 text-white">Buy</button>
      </div>
    </div>
    <div className="mt-4 flex gap-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
        <p className="font-semibold">Status</p>
        <div className="mt-2 space-y-1 text-slate-600">
          <p>Partially received</p>
          <p>Not received</p>
          <p>Received all</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
        <p className="font-semibold">Purchase order</p>
        <p className="mt-2 text-base font-bold text-slate-900">1500 ml</p>
        <button className="mt-2 rounded bg-slate-800 px-2 py-1 text-[11px] text-white">Create</button>
      </div>
    </div>
  </div>
);

const WarehousingMockup = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <p className="font-semibold text-slate-800">Pick Pack</p>
        <p className="mt-2">Natural rubber/blue/high/medium [NR-HIGH-BLUE-MED]</p>
        <p className="mt-1 text-slate-500">A02-B7-01 - 0/2 kilogram</p>
        <div className="mt-3 space-y-1">
          <div className="h-2 rounded bg-slate-200" />
          <div className="h-2 rounded bg-slate-200" />
          <div className="h-2 rounded bg-slate-200" />
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
        <p className="font-semibold text-slate-800">Receive</p>
        <p className="mt-2">A01-B3-01-02</p>
        <p className="mt-1">HDPE Granules / Natural [HDG-NAT]</p>
        <p className="text-slate-500">Batch#: HDG-2025 | 1 pack - 0/1 pack</p>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
      <button className="rounded bg-emerald-600 px-2 py-1 text-white">Start</button>
      <button className="rounded bg-slate-200 px-2 py-1 text-slate-700">Quit this task</button>
      <button className="rounded bg-cobalt px-2 py-1 text-white">Complete</button>
    </div>
  </div>
);

const OrdersMockup = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <p className="mb-2 text-sm font-semibold text-slate-800">Sales Orders</p>
    <div className="grid grid-cols-5 gap-2 rounded-lg bg-slate-50 p-2 text-[11px] font-medium text-slate-500">
      <span>Customer / Channel</span>
      <span>Stock</span>
      <span>Materials</span>
      <span>Production</span>
      <span>Delivery</span>
    </div>
    <div className="mt-2 space-y-2 text-xs">
      {[
        ["IndiaMART", "green", "green", "amber", "slate"],
        ["Direct Sales", "amber", "green", "green", "amber"],
        ["Wholesale", "green", "green", "green", "amber"],
        ["Export Order", "amber", "red", "slate", "slate"],
      ].map(([name, a, b, c, d]) => (
        <div key={name} className="grid grid-cols-5 gap-2 rounded-lg border border-slate-200 px-2 py-2">
          <span>{name}</span>
          <span className={`h-2 w-2 mt-1.5 rounded-full ${statusDot(a as "green" | "amber" | "red" | "slate")}`} />
          <span className={`h-2 w-2 mt-1.5 rounded-full ${statusDot(b as "green" | "amber" | "red" | "slate")}`} />
          <span className={`h-2 w-2 mt-1.5 rounded-full ${statusDot(c as "green" | "amber" | "red" | "slate")}`} />
          <span className={`h-2 w-2 mt-1.5 rounded-full ${statusDot(d as "green" | "amber" | "red" | "slate")}`} />
        </div>
      ))}
    </div>

    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-sm">
      <p className="font-semibold">Current month</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <p>INR 8,86,617 +10%</p>
        <p>INR 6,56,812 +345%</p>
        <p>INR 2,29,805 -65%</p>
        <p>25.92% -68%</p>
      </div>
    </div>
  </div>
);

const tooltipByModule: Record<ModuleId, { title: string; subtitle: string }> = {
  inventory: { title: "143 pcs", subtitle: "in stock" },
  manufacturing: { title: "MO-122", subtitle: "In Progress" },
  purchasing: { title: "1500 ml", subtitle: "Purchase order" },
  warehousing: { title: "HDG-NAT", subtitle: "Batch: HDG-2025" },
  orders: { title: "Current month", subtitle: "4 channels active" },
};

const MockupByModule = ({ id }: { id: ModuleId }) => {
  if (id === "inventory") return <InventoryMockup />;
  if (id === "manufacturing") return <ManufacturingMockup />;
  if (id === "purchasing") return <PurchasingMockup />;
  if (id === "warehousing") return <WarehousingMockup />;
  return <OrdersMockup />;
};

const TiltColumn = ({ module }: { module: ModuleData }) => {
  const tooltip = tooltipByModule[module.id];
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const rawRotateX = useTransform(pointerY, [0, 1], [6, -6]);
  const rawRotateY = useTransform(pointerX, [0, 1], [-6, 6]);
  const rotateX = useSpring(rawRotateX, { stiffness: 180, damping: 18 });
  const rotateY = useSpring(rawRotateY, { stiffness: 180, damping: 18 });

  return (
    <motion.div
      initial={{ x: 60, opacity: 0 }}
      whileInView={{ x: 0, opacity: 1 }}
      viewport={{ amount: 0.35, once: false }}
      transition={{ duration: 0.8, ease: panelEase }}
      className="relative"
    >
      <motion.div
        className="relative rounded-2xl"
        style={{
          rotateX,
          rotateY,
          transformPerspective: 900,
          animation: "float-fast 6s ease-in-out infinite",
        }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          pointerX.set(x / rect.width);
          pointerY.set(y / rect.height);
        }}
        onMouseLeave={() => {
          pointerX.set(0.5);
          pointerY.set(0.5);
        }}
      >
        <div className="rounded-2xl border border-white/70 bg-white p-4 sm:p-6 shadow-[0_24px_80px_rgba(37,99,235,0.12)]">
          <MockupByModule id={module.id} />
        </div>

        <motion.div
          className="absolute right-4 top-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ amount: 0.45, once: false }}
          transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.4 }}
        >
          <p className="text-2xl font-heading font-extrabold text-slate-900">{tooltip.title}</p>
          <p className="text-xs font-body text-slate-600">{tooltip.subtitle}</p>
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute -bottom-10 right-0 sm:-right-4"
        key={module.id}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.35, once: false }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <PersonPlaceholder label={module.personLabel} tint={module.previewTint} />
      </motion.div>
    </motion.div>
  );
};

const ModuleShowcase = () => {
  const [active, setActive] = useState(0);
  const activeModule = modules[active];

  return (
    <motion.section
      className="relative py-16 md:py-20"
      animate={{ backgroundColor: modules[active]?.bg ?? "#F6F8FB" }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-cobalt">Modules</p>
          <h2 className="mt-3 max-w-[740px] font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl md:text-5xl">
            Five core modules. One platform.
          </h2>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {modules.map((module, index) => (
            <button
              key={`${module.id}-preview`}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-xl border bg-white p-2.5 text-left shadow-sm transition-all ${
                active === index
                  ? "border-cobalt scale-[1.02]"
                  : "border-slate-200 hover:border-cobalt/40"
              }`}
            >
              <p className="mb-2 text-[11px] font-heading font-bold text-slate-900">{module.tab}</p>
              <TinyPreview tint={module.previewTint} />
            </button>
          ))}
        </div>

        <div className="sticky top-[76px] z-30 -mx-4 mb-8 border-b border-slate-200 bg-white px-4 sm:top-[92px] sm:mx-0 sm:rounded-xl sm:px-6">
          <div className="flex gap-2 overflow-x-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {modules.map((module, index) => (
              <button
                key={module.id}
                type="button"
                onClick={() => setActive(index)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active === index
                    ? "bg-cobalt text-white"
                    : "bg-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {module.tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.section
            key={activeModule.id}
            className="py-8 md:py-12"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
              <motion.div
                initial={{ x: -60, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ amount: 0.35, once: false }}
                transition={{ duration: 0.8, ease: panelEase }}
              >
                <p className="font-mono text-xs tracking-[0.1em] text-cobalt">{activeModule.eyebrow}</p>
                <h3 className="mt-4 max-w-[560px] font-heading text-[36px] font-extrabold leading-[1.05] text-slate-900 md:text-[44px]">
                  {activeModule.title}
                </h3>
                <p className="mt-5 max-w-[480px] font-body text-[17px] leading-relaxed text-slate-500">
                  {activeModule.body}
                </p>

                <a
                  href="#"
                  className="group mt-7 inline-flex items-center text-lg font-semibold text-cobalt"
                >
                  Read more
                  <span className="relative ml-2 inline-block text-base">
                    {"->"}
                    <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-cobalt transition-all duration-300 group-hover:w-full" />
                  </span>
                </a>

                <div className="mt-8 flex flex-wrap gap-2.5">
                  {activeModule.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-slate-200 bg-[rgba(37,99,235,0.06)] px-3.5 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:border-cobalt hover:bg-[rgba(37,99,235,0.12)]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </motion.div>

              <TiltColumn module={activeModule} />
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

export default ModuleShowcase;
