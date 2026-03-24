import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SaleOrderStatus,
  PaymentStatus,
  MoveOrderStatus,
  ProductionStatus,
  UserStatus,
  Prisma,
} from '@prisma/client';

interface AuditLogQuery {
  userId?: string;
  entityType?: string;
  page?: number;
  limit?: number;
}

interface StockSummaryRow {
  category: string;
  locationId: string;
  locationName: string;
  totalQuantity: number;
  totalValue: number;
}

interface LowStockRow {
  itemId: string;
  standardizedName: string;
  productCode: string;
  category: string;
  locationId: string;
  locationName: string;
  currentQuantity: number;
  minStockLevel: number;
  deficit: number;
}

interface ValuationRow {
  itemId: string;
  standardizedName: string;
  productCode: string;
  category: string;
  locationId: string;
  locationName: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

interface MovementTrendRow {
  date: string;
  in: number;
  out: number;
}

interface TopCustomer {
  id: string;
  name: string;
  revenue: number;
}

interface TopItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
}

interface VendorSummary {
  vendorId: string;
  companyName: string;
  orderCount: number;
  totalAmount: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Dashboard KPIs ──────────────────────

  async getDashboardKPIs() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

    const [
      itemsWithInventory,
      activeProductionOrders,
      pendingMoveOrders,
      todayDispatches,
      pendingApprovals,
      revenueResult,
      outstandingResult,
      pendingUserApprovals,
    ] = await Promise.all([
      this.prisma.item.findMany({
        where: { isActive: true },
        select: {
          minStockLevel: true,
          inventory: { select: { quantity: true } },
        },
      }),
      this.prisma.productionOrder.count({
        where: { status: ProductionStatus.IN_PROGRESS },
      }),
      this.prisma.moveOrder.count({
        where: {
          status: {
            in: [MoveOrderStatus.PENDING, MoveOrderStatus.APPROVED],
          },
        },
      }),
      this.prisma.moveOrder.count({
        where: {
          status: MoveOrderStatus.COMPLETED,
          completedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
      this.prisma.moveOrder.count({
        where: { status: MoveOrderStatus.PENDING },
      }),
      this.prisma.saleOrder.aggregate({
        where: {
          status: { not: SaleOrderStatus.CANCELLED },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.saleOrder.aggregate({
        where: {
          paymentStatus: { not: PaymentStatus.PAID },
          status: { not: SaleOrderStatus.CANCELLED },
        },
        _sum: { totalAmount: true, amountPaid: true },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.PENDING },
      }),
    ]);

    let totalSKUs = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of itemsWithInventory) {
      totalSKUs++;
      const totalQty = item.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0,
      );
      if (totalQty <= 0) {
        outOfStockCount++;
      } else if (totalQty <= item.minStockLevel) {
        lowStockCount++;
      }
    }

    return {
      totalSKUs,
      lowStockCount,
      outOfStockCount,
      activeProductionOrders,
      pendingMoveOrders,
      todayDispatches,
      pendingApprovals,
      revenueThisMonth: revenueResult._sum.totalAmount ?? 0,
      pendingPayments:
        (outstandingResult._sum.totalAmount ?? 0) -
        (outstandingResult._sum.amountPaid ?? 0),
      pendingUserApprovals,
    };
  }

  // ── Stock Summary ───────────────────────

  async getStockSummary(): Promise<StockSummaryRow[]> {
    const inventory = await this.prisma.inventory.findMany({
      include: {
        item: {
          select: {
            standardizedName: true,
            productCode: true,
            category: true,
          },
        },
        location: { select: { name: true, code: true } },
      },
    });

    const grouped = new Map<string, StockSummaryRow>();

    for (const inv of inventory) {
      const key = `${inv.item.category}::${inv.locationId}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.totalQuantity += inv.quantity;
        existing.totalValue += inv.quantity * inv.unitCost;
      } else {
        grouped.set(key, {
          category: inv.item.category,
          locationId: inv.locationId,
          locationName: inv.location.name,
          totalQuantity: inv.quantity,
          totalValue: inv.quantity * inv.unitCost,
        });
      }
    }

    return Array.from(grouped.values());
  }

  // ── Low Stock Report ────────────────────

  async getLowStockReport(): Promise<LowStockRow[]> {
    const inventory = await this.prisma.inventory.findMany({
      include: {
        item: true,
        location: { select: { name: true, code: true } },
      },
    });

    return inventory
      .filter((inv) => inv.quantity <= inv.item.minStockLevel)
      .map((inv) => ({
        itemId: inv.itemId,
        standardizedName: inv.item.standardizedName,
        productCode: inv.item.productCode,
        category: inv.item.category,
        locationId: inv.locationId,
        locationName: inv.location.name,
        currentQuantity: inv.quantity,
        minStockLevel: inv.item.minStockLevel,
        deficit: inv.item.minStockLevel - inv.quantity,
      }));
  }

  // ── Stock Valuation ─────────────────────

  async getStockValuation(): Promise<{
    items: ValuationRow[];
    grandTotal: number;
  }> {
    const inventory = await this.prisma.inventory.findMany({
      include: {
        item: {
          select: {
            standardizedName: true,
            productCode: true,
            category: true,
          },
        },
        location: { select: { name: true, code: true } },
      },
    });

    const items: ValuationRow[] = inventory.map((inv) => ({
      itemId: inv.itemId,
      standardizedName: inv.item.standardizedName,
      productCode: inv.item.productCode,
      category: inv.item.category,
      locationId: inv.locationId,
      locationName: inv.location.name,
      quantity: inv.quantity,
      unitCost: inv.unitCost,
      totalValue: inv.quantity * inv.unitCost,
    }));

    const grandTotal = items.reduce((sum, i) => sum + i.totalValue, 0);

    return { items, grandTotal };
  }

  // ── Movement Trend ──────────────────────

  async getMovementTrend(days: number): Promise<MovementTrendRow[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const entries = await this.prisma.stockLedger.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, movementType: true, quantity: true },
      orderBy: { createdAt: 'asc' },
    });

    const inboundTypes = new Set([
      'IN',
      'TRANSFER_IN',
      'PRODUCTION_IN',
      'RETURN',
    ]);

    const trend = new Map<string, { IN: number; OUT: number }>();

    for (const entry of entries) {
      const dateKey = entry.createdAt.toISOString().slice(0, 10);
      let bucket = trend.get(dateKey);
      if (!bucket) {
        bucket = { IN: 0, OUT: 0 };
        trend.set(dateKey, bucket);
      }
      if (inboundTypes.has(entry.movementType)) {
        bucket.IN += entry.quantity;
      } else {
        bucket.OUT += entry.quantity;
      }
    }

    return Array.from(trend.entries()).map(([date, data]) => ({
      date,
      in: data.IN,
      out: data.OUT,
    }));
  }

  // ── Sales Summary ───────────────────────

  async getSalesSummary(from?: string, to?: string) {
    const where: Prisma.SaleOrderWhereInput = {
      status: { not: SaleOrderStatus.CANCELLED },
    };
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const [orderCount, revenueResult, orders] = await Promise.all([
      this.prisma.saleOrder.count({ where }),
      this.prisma.saleOrder.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
      this.prisma.saleOrder.findMany({
        where,
        include: {
          customer: {
            select: { id: true, companyName: true, primaryContact: true },
          },
          lines: {
            include: {
              item: { select: { id: true, standardizedName: true } },
            },
          },
        },
      }),
    ]);

    const customerRevenue = new Map<string, TopCustomer>();
    for (const order of orders) {
      const existing = customerRevenue.get(order.customerId);
      if (existing) {
        existing.revenue += order.totalAmount;
      } else {
        customerRevenue.set(order.customerId, {
          id: order.customer.id,
          name: order.customer.companyName ?? order.customer.primaryContact,
          revenue: order.totalAmount,
        });
      }
    }
    const topCustomers = Array.from(customerRevenue.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const itemAgg = new Map<string, TopItem>();
    for (const order of orders) {
      for (const line of order.lines) {
        const existing = itemAgg.get(line.itemId);
        if (existing) {
          existing.quantity += line.quantity;
          existing.revenue += line.totalPrice;
        } else {
          itemAgg.set(line.itemId, {
            id: line.item.id,
            name: line.item.standardizedName,
            quantity: line.quantity,
            revenue: line.totalPrice,
          });
        }
      }
    }
    const topItems = Array.from(itemAgg.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      revenue: revenueResult._sum.totalAmount ?? 0,
      orderCount,
      topCustomers,
      topItems,
    };
  }

  // ── Purchase Summary ────────────────────

  async getPurchaseSummary(from?: string, to?: string) {
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const orders = await this.prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: { select: { id: true, companyName: true, vendorId: true } },
      },
    });

    const vendorMap = new Map<string, VendorSummary>();
    for (const po of orders) {
      const existing = vendorMap.get(po.vendorId);
      if (existing) {
        existing.orderCount++;
        existing.totalAmount += po.totalAmount;
      } else {
        vendorMap.set(po.vendorId, {
          vendorId: po.vendor.vendorId,
          companyName: po.vendor.companyName,
          orderCount: 1,
          totalAmount: po.totalAmount,
        });
      }
    }

    return {
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, po) => sum + po.totalAmount, 0),
      byVendor: Array.from(vendorMap.values()).sort(
        (a, b) => b.totalAmount - a.totalAmount,
      ),
    };
  }

  // ── Production Summary ──────────────────

  async getProductionSummary(from?: string, to?: string) {
    const where: Prisma.ProductionOrderWhereInput = {};
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const orders = await this.prisma.productionOrder.findMany({ where });

    const byStatus: Record<string, number> = {};
    let yieldTotal = 0;
    let yieldCount = 0;

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
      if (order.actualQty !== null && order.targetQty > 0) {
        yieldTotal += order.actualQty / order.targetQty;
        yieldCount++;
      }
    }

    return {
      totalOrders: orders.length,
      byStatus,
      averageYieldPercent:
        yieldCount > 0
          ? Math.round((yieldTotal / yieldCount) * 10_000) / 100
          : 0,
    };
  }

  // ── Audit Log ───────────────────────────

  async getAuditLog(query: AuditLogQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.entityType) where.entityType = query.entityType;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
