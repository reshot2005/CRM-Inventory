import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { nextYearlyFormattedIdTx } from '../../common/utils/sequence.util';
import { ERROR_CODES } from '../../common/types/error-codes';
import {
  SaleOrderStatus,
  PaymentStatus,
  MovementType,
  MoveOrderType,
  MoveOrderStatus,
  ChallanStatus,
  Prisma,
} from '@prisma/client';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';
import { CreateChallanDto } from './dto/create-challan.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PurchaseOrderQuery {
  vendorId?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface SaleOrderQuery {
  customerId?: string;
  status?: SaleOrderStatus;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

interface ChallanQuery {
  saleOrderId?: string;
  status?: ChallanStatus;
  page?: number;
  limit?: number;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  private netDaysFromTerms(terms: string | null | undefined): number {
    if (!terms?.trim()) return 30;
    const m = /^NET_(\d+)$/i.exec(terms.trim());
    return m ? parseInt(m[1], 10) : 30;
  }

  private buildPagination(
    total: number,
    page: number,
    limit: number,
  ): PaginationMeta {
    return { total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private buildDateFilter(
    from?: string,
    to?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (from) filter.gte = new Date(from);
    if (to) filter.lte = new Date(to);
    return filter;
  }

  // ── PURCHASE ORDERS ─────────────────────

  async getAllPurchaseOrders(query: PurchaseOrderQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {};
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.status) where.status = query.status;
    const dateFilter = this.buildDateFilter(query.from, query.to);
    if (dateFilter) where.createdAt = dateFilter;

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { vendor: true, lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, meta: this.buildPagination(total, page, limit) };
  }

  async getPurchaseOrderById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { vendor: true, lines: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: string) {
    const totalAmount = dto.lines.reduce(
      (sum, l) => sum + l.orderedQty * l.unitPrice,
      0,
    );

    const po = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const poNumber = await nextYearlyFormattedIdTx(tx, 'PO', year);
      const created = await tx.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: dto.vendorId,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          totalAmount,
          notes: dto.notes,
          createdBy: userId,
          lines: {
            create: dto.lines.map((l) => ({
              itemId: l.itemId,
              orderedQty: l.orderedQty,
              unitPrice: l.unitPrice,
            })),
          },
        },
        include: { vendor: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PO',
          entityType: 'PurchaseOrder',
          entityId: created.id,
          newValues: {
            poNumber,
            vendorId: dto.vendorId,
            totalAmount,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return po;
  }

  async updatePurchaseOrder(
    id: string,
    dto: UpdatePurchaseOrderDto,
    userId: string,
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only DRAFT purchase orders can be updated',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines && dto.lines.length > 0) {
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        });
        await tx.purchaseOrderLine.createMany({
          data: dto.lines.map((l) => ({
            purchaseOrderId: id,
            itemId: l.itemId,
            orderedQty: l.orderedQty,
            unitPrice: l.unitPrice,
          })),
        });
      }

      const totalAmount = dto.lines?.length
        ? dto.lines.reduce((sum, l) => sum + l.orderedQty * l.unitPrice, 0)
        : undefined;

      const data: Prisma.PurchaseOrderUpdateInput = {};
      if (dto.vendorId !== undefined)
        data.vendor = { connect: { id: dto.vendorId } };
      if (dto.expectedDate !== undefined)
        data.expectedDate = dto.expectedDate
          ? new Date(dto.expectedDate)
          : null;
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (totalAmount !== undefined) data.totalAmount = totalAmount;

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data,
        include: { vendor: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE_PO',
          entityType: 'PurchaseOrder',
          entityId: id,
          oldValues: {
            vendorId: po.vendorId,
            totalAmount: po.totalAmount,
          } as Prisma.InputJsonValue,
          newValues: {
            vendorId: dto.vendorId,
            notes: dto.notes,
            linesUpdated: !!dto.lines,
          } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  async receivePurchaseOrder(
    id: string,
    dto: ReceivePurchaseOrderDto,
    userId: string,
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status === 'RECEIVED') {
      throw new BadRequestException(
        'Purchase order is already fully received',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const receiveLine of dto.lines) {
        if (receiveLine.receivedQty <= 0) continue;

        const poLine = po.lines.find((l) => l.id === receiveLine.lineId);
        if (!poLine) {
          throw new BadRequestException(
            `PO line ${receiveLine.lineId} not found`,
          );
        }

        await tx.purchaseOrderLine.update({
          where: { id: receiveLine.lineId },
          data: {
            receivedQty: { increment: receiveLine.receivedQty },
            ...(receiveLine.batchNumber
              ? { batchNumber: receiveLine.batchNumber }
              : {}),
          },
        });

        const inv = await tx.inventory.upsert({
          where: {
            locationId_itemId: {
              locationId: receiveLine.locationId,
              itemId: poLine.itemId,
            },
          },
          create: {
            locationId: receiveLine.locationId,
            itemId: poLine.itemId,
            quantity: receiveLine.receivedQty,
            unitCost: poLine.unitPrice,
          },
          update: {
            quantity: { increment: receiveLine.receivedQty },
            unitCost: poLine.unitPrice,
          },
        });

        await tx.stockLedger.create({
          data: {
            locationId: receiveLine.locationId,
            itemId: poLine.itemId,
            movementType: MovementType.IN,
            quantity: receiveLine.receivedQty,
            balanceAfter: inv.quantity,
            unitCost: poLine.unitPrice,
            referenceType: 'PurchaseOrder',
            referenceId: po.id,
            createdBy: userId,
          },
        });
      }

      const updatedLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: id },
      });
      const allReceived = updatedLines.every(
        (l) => l.receivedQty >= l.orderedQty,
      );

      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED',
        },
        include: { vendor: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'RECEIVE_PO',
          entityType: 'PurchaseOrder',
          entityId: id,
          newValues: {
            status: updated.status,
            receivedLines: dto.lines.length,
          } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  // ── SALE ORDERS ─────────────────────────

  async getAllSaleOrders(query: SaleOrderQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SaleOrderWhereInput = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    const dateFilter = this.buildDateFilter(query.from, query.to);
    if (dateFilter) where.createdAt = dateFilter;

    const [data, total] = await Promise.all([
      this.prisma.saleOrder.findMany({
        where,
        include: { customer: true, lines: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.saleOrder.count({ where }),
    ]);

    return { data, meta: this.buildPagination(total, page, limit) };
  }

  async getSaleOrderById(id: string) {
    const order = await this.prisma.saleOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { include: { item: true } },
        challans: true,
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Sale order not found');
    return order;
  }

  async createSaleOrder(dto: CreateSaleOrderDto, userId: string) {
    const linesData = dto.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.quantity * l.unitPrice,
    }));
    const totalAmount = linesData.reduce((sum, l) => sum + l.totalPrice, 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const orderNumber = await nextYearlyFormattedIdTx(tx, 'SO', year);
      const created = await tx.saleOrder.create({
        data: {
          orderNumber,
          customerId: dto.customerId,
          locationId: dto.locationId,
          notes: dto.notes,
          totalAmount,
          createdBy: userId,
          lines: { create: linesData },
        },
        include: { customer: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_SO',
          entityType: 'SaleOrder',
          entityId: created.id,
          newValues: {
            orderNumber,
            customerId: dto.customerId,
            totalAmount,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return order;
  }

  async confirmSaleOrder(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.findUnique({
        where: { id },
        include: { lines: true, customer: true },
      });
      if (!order) throw new NotFoundException('Sale order not found');
      if (order.status !== SaleOrderStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT orders can be confirmed');
      }

      const locationId = order.locationId;
      if (!locationId) {
        throw new BadRequestException(
          'Sale order must have a location to confirm',
        );
      }

      if (order.customer.creditLimit !== null) {
        const openOrders = await tx.saleOrder.findMany({
          where: {
            customerId: order.customerId,
            status: {
              in: [
                SaleOrderStatus.CONFIRMED,
                SaleOrderStatus.PROCESSING,
                SaleOrderStatus.DISPATCHED,
              ],
            },
            id: { not: id },
          },
          select: { totalAmount: true, amountPaid: true },
        });
        const outstanding = openOrders.reduce(
          (sum, o) => sum + (o.totalAmount - o.amountPaid),
          0,
        );
        if (outstanding + order.totalAmount > order.customer.creditLimit) {
          throw new BadRequestException({
            code: ERROR_CODES.SALES_002.code,
            message: ERROR_CODES.SALES_002.message,
          });
        }
      }

      for (const line of order.lines) {
        await this.inventoryService.reserveStock(
          tx,
          locationId,
          line.itemId,
          line.quantity,
        );
      }

      const confirmed = await tx.saleOrder.update({
        where: { id },
        data: { status: SaleOrderStatus.CONFIRMED },
        include: { customer: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CONFIRM_SO',
          entityType: 'SaleOrder',
          entityId: id,
          oldValues: {
            status: SaleOrderStatus.DRAFT,
          } as Prisma.InputJsonValue,
          newValues: {
            status: SaleOrderStatus.CONFIRMED,
          } as Prisma.InputJsonValue,
        },
      });

      return confirmed;
    });
  }

  async dispatchSaleOrder(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!order) throw new NotFoundException('Sale order not found');
      if (order.status !== SaleOrderStatus.CONFIRMED) {
        throw new BadRequestException(
          'Only CONFIRMED orders can be dispatched',
        );
      }

      const locationId = order.locationId;
      if (!locationId) {
        throw new BadRequestException('Sale order has no location');
      }

      const year = new Date().getFullYear();
      const moNumber = await nextYearlyFormattedIdTx(tx, 'MO', year);
      await tx.moveOrder.create({
        data: {
          orderNumber: moNumber,
          type: MoveOrderType.SALE,
          status: MoveOrderStatus.COMPLETED,
          fromLocationId: locationId,
          createdBy: userId,
          saleOrderId: order.id,
          lines: {
            create: order.lines.map((l) => ({
              itemId: l.itemId,
              requestedQty: l.quantity,
              dispatchedQty: l.quantity,
              receivedQty: l.quantity,
            })),
          },
        },
      });

      for (const line of order.lines) {
        const invRow = await tx.inventory.findUnique({
          where: { locationId_itemId: { locationId, itemId: line.itemId } },
        });
        await this.inventoryService.processStockMovement(
          {
            locationId,
            itemId: line.itemId,
            movementType: MovementType.OUT,
            quantity: line.quantity,
            referenceType: 'SaleOrder',
            referenceId: order.id,
            notes: `Dispatch ${order.orderNumber}`,
            createdBy: userId,
            unitCost: invRow?.unitCost,
          },
          tx,
        );
        await tx.inventory.update({
          where: { locationId_itemId: { locationId, itemId: line.itemId } },
          data: { reservedQty: { decrement: line.quantity } },
        });
      }

      const dispatched = await tx.saleOrder.update({
        where: { id },
        data: {
          status: SaleOrderStatus.DISPATCHED,
          dispatchedAt: new Date(),
        },
        include: { customer: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DISPATCH_SO',
          entityType: 'SaleOrder',
          entityId: id,
          newValues: {
            status: SaleOrderStatus.DISPATCHED,
          } as Prisma.InputJsonValue,
        },
      });

      return dispatched;
    });
  }

  async deliverSaleOrder(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.findUnique({
        where: { id },
        include: { customer: true },
      });
      if (!order) throw new NotFoundException('Sale order not found');
      if (order.status !== SaleOrderStatus.DISPATCHED) {
        throw new BadRequestException(
          'Only DISPATCHED orders can be delivered',
        );
      }

      const delivered = await tx.saleOrder.update({
        where: { id },
        data: {
          status: SaleOrderStatus.DELIVERED,
          deliveredAt: new Date(),
        },
        include: { customer: true, lines: true },
      });

      await tx.customerActivity.create({
        data: {
          customerId: order.customerId,
          type: 'ORDER_DELIVERED',
          content: `Order ${order.orderNumber} delivered`,
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELIVER_SO',
          entityType: 'SaleOrder',
          entityId: id,
          newValues: {
            status: SaleOrderStatus.DELIVERED,
          } as Prisma.InputJsonValue,
        },
      });

      return delivered;
    });
  }

  async cancelSaleOrder(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!order) throw new NotFoundException('Sale order not found');
      if (
        order.status !== SaleOrderStatus.DRAFT &&
        order.status !== SaleOrderStatus.CONFIRMED &&
        order.status !== SaleOrderStatus.PROCESSING
      ) {
        throw new BadRequestException({
          code: ERROR_CODES.SALES_003.code,
          message: ERROR_CODES.SALES_003.message,
        });
      }

      if (
        (order.status === SaleOrderStatus.CONFIRMED ||
          order.status === SaleOrderStatus.PROCESSING) &&
        order.locationId
      ) {
        for (const line of order.lines) {
          await tx.inventory.update({
            where: {
              locationId_itemId: {
                locationId: order.locationId,
                itemId: line.itemId,
              },
            },
            data: { reservedQty: { decrement: line.quantity } },
          });
        }
      }

      const cancelled = await tx.saleOrder.update({
        where: { id },
        data: { status: SaleOrderStatus.CANCELLED },
        include: { customer: true, lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_SO',
          entityType: 'SaleOrder',
          entityId: id,
          oldValues: { status: order.status } as Prisma.InputJsonValue,
          newValues: {
            status: SaleOrderStatus.CANCELLED,
          } as Prisma.InputJsonValue,
        },
      });

      return cancelled;
    });
  }

  // ── CHALLANS ────────────────────────────

  async getAllChallans(query: ChallanQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DeliveryChallanWhereInput = {};
    if (query.saleOrderId) where.saleOrderId = query.saleOrderId;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.deliveryChallan.findMany({
        where,
        include: { saleOrder: { include: { customer: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.deliveryChallan.count({ where }),
    ]);

    return { data, meta: this.buildPagination(total, page, limit) };
  }

  async getChallanById(id: string) {
    const challan = await this.prisma.deliveryChallan.findUnique({
      where: { id },
      include: {
        saleOrder: {
          include: {
            customer: true,
            lines: { include: { item: true } },
          },
        },
      },
    });
    if (!challan) {
      throw new NotFoundException({
        code: ERROR_CODES.SALES_004.code,
        message: ERROR_CODES.SALES_004.message,
      });
    }
    return challan;
  }

  async createChallan(dto: CreateChallanDto, userId: string) {
    const challan = await this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.findUnique({
        where: { id: dto.saleOrderId },
      });
      if (!order) throw new NotFoundException('Sale order not found');

      const year = new Date().getFullYear();
      const challanNumber = await nextYearlyFormattedIdTx(tx, 'DC', year);

      const created = await tx.deliveryChallan.create({
        data: {
          challanNumber,
          saleOrderId: dto.saleOrderId,
          fromAddress: dto.fromAddress,
          toAddress: dto.toAddress,
          vehicleNo: dto.vehicleNo,
          status: ChallanStatus.GENERATED,
          generatedAt: new Date(),
        },
        include: {
          saleOrder: {
            include: {
              customer: true,
              lines: { include: { item: true } },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_CHALLAN',
          entityType: 'DeliveryChallan',
          entityId: created.id,
          newValues: {
            challanNumber,
            saleOrderId: dto.saleOrderId,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return challan;
  }

  async getChallanPdf(id: string) {
    const challan = await this.prisma.deliveryChallan.findUnique({
      where: { id },
      include: {
        saleOrder: {
          include: {
            customer: true,
            lines: { include: { item: true } },
          },
        },
      },
    });
    if (!challan) {
      throw new NotFoundException({
        code: ERROR_CODES.SALES_004.code,
        message: ERROR_CODES.SALES_004.message,
      });
    }
    return challan;
  }

  // ── PAYMENTS ────────────────────────────

  async recordPayment(dto: RecordPaymentDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.saleOrder.findUnique({
        where: { id: dto.saleOrderId },
        include: { customer: true },
      });
      if (!order) throw new NotFoundException('Sale order not found');

      const payment = await tx.payment.create({
        data: {
          saleOrderId: dto.saleOrderId,
          amount: dto.amount,
          mode: dto.mode,
          referenceNo: dto.referenceNo,
          notes: dto.notes,
          receivedBy: userId,
        },
      });

      const newAmountPaid = order.amountPaid + dto.amount;
      let paymentStatus: PaymentStatus;
      if (newAmountPaid >= order.totalAmount) {
        paymentStatus = PaymentStatus.PAID;
      } else if (newAmountPaid > 0) {
        paymentStatus = PaymentStatus.PARTIAL;
      } else {
        paymentStatus = PaymentStatus.PENDING;
      }

      const netDays = this.netDaysFromTerms(order.customer.paymentTerms);
      const dueDate = new Date(order.createdAt);
      dueDate.setDate(dueDate.getDate() + netDays);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDay = new Date(dueDate);
      dueDay.setHours(0, 0, 0, 0);
      if (
        paymentStatus !== PaymentStatus.PAID &&
        today > dueDay &&
        newAmountPaid < order.totalAmount
      ) {
        paymentStatus = PaymentStatus.OVERDUE;
      }

      await tx.saleOrder.update({
        where: { id: dto.saleOrderId },
        data: { amountPaid: newAmountPaid, paymentStatus },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'RECORD_PAYMENT',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: {
            saleOrderId: dto.saleOrderId,
            amount: dto.amount,
            mode: dto.mode,
            newAmountPaid,
            paymentStatus,
          } as Prisma.InputJsonValue,
        },
      });

      return payment;
    });
  }

  async getPaymentsByOrder(saleOrderId: string) {
    return this.prisma.payment.findMany({
      where: { saleOrderId },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async getOutstandingPayments() {
    return this.prisma.saleOrder.findMany({
      where: {
        paymentStatus: { not: PaymentStatus.PAID },
        status: { not: SaleOrderStatus.CANCELLED },
      },
      include: { customer: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
