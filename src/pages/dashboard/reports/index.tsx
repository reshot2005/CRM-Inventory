import PageHeader from "@/components/shared/PageHeader";
import MiniChart from "@/components/shared/MiniChart";
import DataTable, { type DataColumn } from "@/components/shared/DataTable";

type Row = { report: string; period: string; value: string; trend: number[]; owner: string; };
const rows: Row[] = [
  { report: "Stock Valuation", period: "Mar 2025", value: "?24,86,500", trend: [20, 22, 23, 25, 24, 26], owner: "Finance" },
  { report: "Low Stock Summary", period: "Mar 2025", value: "37 items", trend: [40, 38, 42, 39, 37, 35], owner: "Inventory" },
  { report: "Move Order Aging", period: "Mar 2025", value: "7 active", trend: [9, 8, 9, 7, 8, 7], owner: "Warehousing" },
];
const columns: DataColumn<Row>[] = [
  { id: "report", header: "Report", render: (r) => r.report },
  { id: "period", header: "Period", render: (r) => r.period },
  { id: "value", header: "Value", render: (r) => r.value },
  { id: "trend", header: "Trend", render: (r) => <div className="w-28"><MiniChart data={r.trend} color="#2563EB" /></div> },
  { id: "owner", header: "Owner", render: (r) => r.owner },
  { id: "actions", header: "Actions", render: () => <button className="rounded bg-[#2563EB] px-2 py-1 text-xs text-white">Open</button> },
];

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <PageHeader breadcrumb={["Reports"]} title="Reports" subtitle="Operational and financial visibility across inventory modules" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["Inventory Value: ?24,86,500", "Pending Transfers: 7", "Critical Low Stock: 3", "Monthly Turnover: 25.92%"].map((x) => (
          <div key={x} className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-medium text-[#0F172A]">{x}</div>
        ))}
      </div>
      <DataTable columns={columns} data={rows} totalItems={rows.length} />
    </div>
  );
}
