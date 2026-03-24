import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardIndexPage from "@/pages/dashboard";
import ProductsPage from "@/pages/dashboard/products";
import RawMaterialsPage from "@/pages/dashboard/raw-materials";
import FinishedGoodsPage from "@/pages/dashboard/finished-goods";
import PackagingPage from "@/pages/dashboard/packaging";
import LocationsPage from "@/pages/dashboard/locations";
import StockTransfersPage from "@/pages/dashboard/transfers";
import StockAdjustmentsPage from "@/pages/dashboard/adjustments";
import PurchaseOrdersPage from "@/pages/dashboard/purchase-orders";
import CreatePOPage from "@/pages/dashboard/purchase-orders/new";
import VendorsPage from "@/pages/dashboard/vendors";
import ReceiveStockPage from "@/pages/dashboard/receive";
import SalesOrdersPage from "@/pages/dashboard/sales-orders";
import CustomersPage from "@/pages/dashboard/customers";
import DeliveryChallansPage from "@/pages/dashboard/challans";
import ProductionOrdersPage from "@/pages/dashboard/production";
import BillsOfMaterialsPage from "@/pages/dashboard/bom";
import ReportsPage from "@/pages/dashboard/reports";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardIndexPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="raw-materials" element={<RawMaterialsPage />} />
            <Route path="finished-goods" element={<FinishedGoodsPage />} />
            <Route path="packaging" element={<PackagingPage />} />
            <Route path="locations" element={<LocationsPage />} />
            <Route path="transfers" element={<StockTransfersPage />} />
            <Route path="adjustments" element={<StockAdjustmentsPage />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="purchase-orders/new" element={<CreatePOPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="receive" element={<ReceiveStockPage />} />
            <Route path="sales-orders" element={<SalesOrdersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="challans" element={<DeliveryChallansPage />} />
            <Route path="production" element={<ProductionOrdersPage />} />
            <Route path="bom" element={<BillsOfMaterialsPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
