import { Boxes, CircleCheck, AlertTriangle, Timer } from "lucide-react";
import ModuleTablePage from "@/pages/dashboard/ModuleTablePage";
import type { DataColumn } from "@/components/shared/DataTable";
import AlertBanner from "@/components/shared/AlertBanner";
import StatusBadge from "@/components/shared/StatusBadge";

type Row = { item: string; code: string; size: string; supplier: string; qty: string; min: string; };

const rows: Row[] = [
  { item: "HDPE Granules", code: "RAW-001", size: "25kg Bag", supplier: "Sharma Polymers", qty: "143 kg", min: "500 kg" },
  { item: "LDPE Film", code: "RAW-007", size: "50kg Roll", supplier: "ChemPlast", qty: "890 kg", min: "200 kg" },
  { item: "Master Batch Black", code: "RAW-012", size: "20kg Bag", supplier: "ColorTech", qty: "45 kg", min: "50 kg" },
  { item: "PVC Granules", code: "RAW-003", size: "25kg Bag", supplier: "ChemPlast", qty: "560 kg", min: "300 kg" },
];

const columns: DataColumn<Row>[] = [
  { id: "item", header: "Item", render: (r) => r.item, sortValue: (r) => r.item },
  { id: "code", header: "Product Code", render: (r) => <span className="font-mono text-[#64748B]">{r.code}</span> },
  { id: "size", header: "Packaging Size", render: (r) => r.size },
  { id: "supplier", header: "Supplier", render: (r) => r.supplier },
  { id: "qty", header: "Qty", render: (r) => r.qty },
  { id: "min", header: "Min", render: (r) => r.min },
  { id: "status", header: "Status", render: (r) => <StatusBadge variant={Number(r.qty.split(" ")[0]) < Number(r.min.split(" ")[0]) ? "warning" : "success"} label={Number(r.qty.split(" ")[0]) < Number(r.min.split(" ")[0]) ? "Low" : "In Stock"} /> },
  { id: "po", header: "PO", render: () => <button className="rounded bg-[#2563EB] px-2 py-1 text-xs text-white">Create PO</button> },
];

export default function RawMaterialsPage() {
  return (
    <ModuleTablePage
      breadcrumb={["Inventory", "Raw Materials"]}
      title="Raw Materials"
      subtitle="Raw material ledger with supplier linkage and reorder insights"
      alert={<AlertBanner type="info" message="AI Reorder Recommendations: 2 materials need purchase orders this week." />}
      stats={[
        { label: "Total Raw Materials", value: 426, icon: Boxes, iconColor: "#EA580C", iconBg: "#FFF4F0", ringColor: "#F97316", ringValue: 70 },
        { label: "In Stock", value: 389, icon: CircleCheck, iconColor: "#16A34A", iconBg: "#ECFDF3", ringColor: "#22C55E", ringValue: 82 },
        { label: "Low Stock", value: 29, icon: AlertTriangle, iconColor: "#D97706", iconBg: "#FEF3C7", ringColor: "#F59E0B", ringValue: 31 },
        { label: "Avg Reorder Time", value: 6, icon: Timer, iconColor: "#2563EB", iconBg: "#E0ECFF", ringColor: "#2563EB", ringValue: 45 },
      ]}
      columns={columns}
      data={rows}
      searchPlaceholder="Search raw materials by code or supplier..."
      addLabel="Add Raw Material"
    />
  );
}
