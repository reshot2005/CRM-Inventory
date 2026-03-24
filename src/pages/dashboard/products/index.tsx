import { useState } from "react";
import PageHeader from "@/components/shared/PageHeader";
import AlertBanner from "@/components/shared/AlertBanner";
import StatCard from "@/components/shared/StatCard";
import SearchFilterBar from "@/components/shared/SearchFilterBar";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import RightPanel from "@/components/shared/RightPanel";

type ProductRow = {
  name: string;
  code: string;
  category: string;
  brand: string;
  pkgType: string;
  qty: string;
  min: string;
  status: "success" | "warning" | "danger";
};

const rows: ProductRow[] = [
  { name: "HDPE Granules", code: "RAW-001", category: "Raw Material", brand: "—", pkgType: "Bags", qty: "143 kg", min: "500 kg", status: "warning" },
  { name: "PP Woven Sack 50kg", code: "PKG-011", category: "Packaging", brand: "—", pkgType: "Sacks", qty: "2200 pc", min: "500 pc", status: "success" },
  { name: "PremiumBond Tape", code: "PKG-045", category: "Packaging", brand: "BondPro", pkgType: "Roll", qty: "200 pc", min: "1000 pc", status: "warning" },
  { name: "LDPE Film Roll", code: "RAW-007", category: "Raw Material", brand: "—", pkgType: "Roll", qty: "890 kg", min: "200 kg", status: "success" },
  { name: "Corrugated Sheet B", code: "PKG-022", category: "Packaging", brand: "—", pkgType: "Sheet", qty: "8 pc", min: "100 pc", status: "danger" },
  { name: "PVC Granules", code: "RAW-003", category: "Raw Material", brand: "ChemPlast", pkgType: "Bags", qty: "560 kg", min: "300 kg", status: "success" },
  { name: "Master Batch Black", code: "RAW-012", category: "Raw Material", brand: "ColorTech", pkgType: "Bags", qty: "45 kg", min: "50 kg", status: "warning" },
  { name: "Stretch Wrap Film", code: "PKG-033", category: "Packaging", brand: "WrapKing", pkgType: "Roll", qty: "340 pc", min: "100 pc", status: "success" },
];

const columns: DataColumn<ProductRow>[] = [
  { id: "name", header: "Item Name", render: (r) => r.name, sortValue: (r) => r.name },
  { id: "code", header: "Product Code", render: (r) => <span className="font-mono text-[#64748B]">{r.code}</span>, sortValue: (r) => r.code },
  { id: "category", header: "Category", render: (r) => r.category },
  { id: "brand", header: "Brand", render: (r) => r.brand },
  { id: "pkgType", header: "Pkg Type", render: (r) => r.pkgType },
  { id: "qty", header: "Qty", render: (r) => r.qty, sortValue: (r) => Number(r.qty.split(" ")[0]) },
  { id: "min", header: "Min Level", render: (r) => r.min },
  {
    id: "status",
    header: "Stock Status",
    render: (r) => <StatusBadge variant={r.status} label={r.status === "success" ? "In Stock" : r.status === "warning" ? "Low" : "Out"} />,
  },
  { id: "actions", header: "Actions", render: () => <button className="rounded bg-[#F1F5F9] px-2 py-1 text-xs">?</button> },
];

export default function ProductsPage() {
  const [active, setActive] = useState<ProductRow | null>(null);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={["Inventory", "Products & SKUs"]}
        title="Products & SKUs"
        subtitle="1,284 total items across all categories"
        actions={
          <>
            <button className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm">Import CSV</button>
            <button className="rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-medium text-white">Add Product</button>
          </>
        }
      />

      <AlertBanner
        type="warning"
        message="37 products are below minimum stock level."
        action={<a href="#" className="text-sm font-semibold underline">View Low Stock ?</a>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total SKUs" value={1284} iconEmoji="??" iconBg="#FFF4F0" ringColor="#F97316" ringValue={72} />
        <StatCard label="Active Products" value={1186} iconEmoji="?" iconBg="#ECFDF3" ringColor="#22C55E" ringValue={85} />
        <StatCard label="Low Stock Items" value={37} iconEmoji="??" iconBg="#FEF3C7" ringColor="#F59E0B" ringValue={28} />
        <StatCard label="Out of Stock" value={12} iconEmoji="??" iconBg="#FEE2E2" ringColor="#EF4444" ringValue={9} />
      </div>

      <SearchFilterBar placeholder="Search by name, code, brand..." addLabel="Add Product" filters={<><select className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"><option>Category</option></select><select className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"><option>Stock Status</option></select><select className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm"><option>Brand</option></select></>} />

      <DataTable columns={columns} data={rows} onRowClick={setActive} totalItems={284} />

      <RightPanel open={Boolean(active)} onClose={() => setActive(null)} title={active?.name ?? ""} subtitle={active?.code ? `Product Code: ${active.code}` : ""}>
        {active ? (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E2E8F0] p-3">
              <p className="text-[#64748B]">Code</p><p className="font-mono">{active.code}</p>
              <p className="text-[#64748B]">Category</p><p>{active.category}</p>
              <p className="text-[#64748B]">Brand</p><p>{active.brand}</p>
              <p className="text-[#64748B]">Pkg Type</p><p>{active.pkgType}</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] p-3">
              <p className="text-[#64748B]">Current stock</p>
              <p className="text-2xl font-bold text-[#0F172A]">{active.qty}</p>
              <p className="mt-2 text-[#64748B]">Min level: {active.min}</p>
              <div className="mt-2 h-2 rounded bg-[#E2E8F0]"><div className="h-2 w-1/3 rounded bg-[#2563EB]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-[#2563EB] px-3 py-2 text-white">Adjust Stock</button>
              <button className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">View Full Ledger</button>
            </div>
          </div>
        ) : null}
      </RightPanel>
    </div>
  );
}
