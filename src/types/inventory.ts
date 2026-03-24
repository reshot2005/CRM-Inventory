export interface Product {
  id: string;
  standardizedName: string;
  productCode: string;
  brand?: string;
  packagingType?: "Box" | "Packets" | "Others" | "Bags" | "Roll" | "Sheet";
  packagingSize?: string;
  quantity: number;
  minStockLevel: number;
  category: "RawMaterial" | "FinishedGood" | "Packaging" | "Other";
  specifications?: Record<string, string>;
}

export interface Vendor {
  vendorId: string;
  companyName: string;
  contacts: VendorContact[];
  materialsSupplied: string[];
  gstin?: string;
  paymentTerms: string;
  documents: AppDocument[];
  remarks?: string;
}

export interface VendorContact {
  name: string;
  role: string;
  phones: string[];
  email?: string;
}

export interface Customer {
  customerId: string;
  type: "Individual" | "Business";
  companyName: string;
  primaryContact: string;
  phones: string[];
  address: string;
  gmapsLocation?: string;
  activityLog: ActivityEntry[];
}

export interface TransferItem {
  productCode: string;
  itemName: string;
  quantity: number;
  unit: string;
}

export interface StockTransfer {
  transferId: string;
  fromLocation: string;
  toLocation: string;
  type: "Sale" | "Transfer";
  items: TransferItem[];
  status: "Draft" | "Pending" | "InTransit" | "Received" | "Cancelled";
  createdAt: Date;
}

export interface BOMItem {
  rawMaterialId: string;
  quantityRequired: number;
  unit: string;
}

export interface ProductionOrder {
  orderId: string;
  finishedGoodId: string;
  targetQty: number;
  deadline: Date;
  status: "Planned" | "InProgress" | "Paused" | "Completed" | "Blocked";
  bom: BOMItem[];
}

export interface ChallanItem {
  itemName: string;
  productCode: string;
  qty: number;
  unit: string;
}

export interface DeliveryChallan {
  challanNo: string;
  salesOrderId: string;
  customerId: string;
  fromAddress: string;
  toAddress: string;
  items: ChallanItem[];
  date: Date;
  status: "Draft" | "Generated" | "Delivered";
}

export interface ActivityEntry {
  id: string;
  date: string;
  message: string;
  icon: string;
}

export interface AppDocument {
  id: string;
  name: string;
  uploadedAt: string;
  type: "pdf" | "image" | "sheet";
}
