import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Prisma,
  PrismaClient,
  ItemCategory,
  MovementType,
  MoveOrderStatus,
} from '@prisma/client';
import { ERROR_CODES } from '../../common/types/error-codes';
import { nextYearlyFormattedIdTx } from '../../common/utils/sequence.util';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  CreateMoveOrderDto,
  CompleteMoveOrderDto,
} from './dto/create-move-order.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { CreateLocationDto } from './dto/create-location.dto';

type PrismaTx = Omit<
  PrismaClient,
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$transaction'
  | '$use'
  | '$extends'
>;

interface StockMovementPayload {
  locationId: string;
  itemId: string;
  movementType: MovementType;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
}

const INCOMING_TYPES: MovementType[] = [
  'IN',
  'TRANSFER_IN',
  'PRODUCTION_IN',
  'RETURN',
];

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── ITEMS ──────────────────────────────────────────────────

  async getAllItems(query: {
    category?: ItemCategory;
    brand?: string;
    lowStock?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { category, brand, lowStock, search, page = 1, limit = 20 } = query;

    const where: Prisma.ItemWhereInput = { isActive: true };
    if (category) where.category = category;
    if (brand) where.brand = { contains: brand, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { standardizedName: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        include: {
          inventory: {
            select: { quantity: true, reservedQty: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { standardizedName: 'asc' },
      }),
      this.prisma.item.count({ where }),
    ]);

    let mapped = items.map((item) => {
      const totalStock = item.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0,
      );
      const totalReserved = item.inventory.reduce(
        (sum, inv) => sum + inv.reservedQty,
        0,
      );
      const { inventory: _inv, ...rest } = item;
      return {
        ...rest,
        totalStock,
        totalReserved,
        availableStock: totalStock - totalReserved,
      };
    });

    if (lowStock) {
      mapped = mapped.filter((i) => i.totalStock <= i.minStockLevel);
    }

    const finalTotal = lowStock ? mapped.length : total;
    const totalPages = Math.ceil(finalTotal / limit);

    return {
      data: mapped,
      meta: {
        page,
        limit,
        total: finalTotal,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async getItemById(id: string) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        inventory: { include: { location: true } },
        ledgerEntries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  async createItem(dto: CreateItemDto, creatorId: string) {
    const existing = await this.prisma.item.findUnique({
      where: { productCode: dto.productCode },
    });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.INV_003.code,
        message: ERROR_CODES.INV_003.message,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          standardizedName: dto.standardizedName,
          productCode: dto.productCode,
          brand: dto.brand,
          category: dto.category,
          packagingType: dto.packagingType,
          packagingSize: dto.packagingSize,
          minStockLevel: dto.minStockLevel,
          specifications: dto.specifications as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      const activeLocations = await tx.location.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (activeLocations.length > 0) {
        await tx.inventory.createMany({
          data: activeLocations.map((loc) => ({
            locationId: loc.id,
            itemId: item.id,
            quantity: 0,
            reservedQty: 0,
            unitCost: 0,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'CREATE_ITEM',
          entityType: 'Item',
          entityId: item.id,
          newValues: {
            standardizedName: dto.standardizedName,
            productCode: dto.productCode,
            category: dto.category,
          } as Prisma.InputJsonValue,
        },
      });

      return item;
    });
  }

  async updateItem(id: string, dto: UpdateItemDto, updaterId: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);

    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};
    const dtoRecord = dto as Record<string, unknown>;
    const itemRecord = item as Record<string, unknown>;

    for (const key of Object.keys(dtoRecord)) {
      if (dtoRecord[key] !== undefined) {
        oldValues[key] = itemRecord[key];
        newValues[key] = dtoRecord[key];
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id },
        data: {
          standardizedName: dto.standardizedName,
          productCode: dto.productCode,
          brand: dto.brand,
          category: dto.category,
          packagingType: dto.packagingType,
          packagingSize: dto.packagingSize,
          minStockLevel: dto.minStockLevel,
          specifications: dto.specifications as
            | Prisma.InputJsonValue
            | undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: updaterId,
          action: 'UPDATE_ITEM',
          entityType: 'Item',
          entityId: id,
          oldValues: oldValues as Prisma.InputJsonValue,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  async deleteItem(id: string, deleterId: string) {
    const item = await this.prisma.item.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);

    const activeMoveOrders = await this.prisma.moveOrderLine.count({
      where: {
        itemId: id,
        moveOrder: {
          status: { in: ['DRAFT', 'PENDING', 'APPROVED', 'IN_TRANSIT'] },
        },
      },
    });

    if (activeMoveOrders > 0) {
      throw new BadRequestException(
        'Cannot deactivate item with active move orders',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.item.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId: deleterId,
          action: 'DEACTIVATE_ITEM',
          entityType: 'Item',
          entityId: id,
          oldValues: { isActive: true },
          newValues: { isActive: false },
        },
      });

      return updated;
    });
  }

  // ─── STOCK QUERIES ──────────────────────────────────────────

  async getStockByItem(itemId: string) {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);

    const rows = await this.prisma.inventory.findMany({
      where: { itemId },
      include: { location: true },
    });

    return rows.map((row) => ({
      ...row,
      available: row.quantity - row.reservedQty,
    }));
  }

  async getLowStockItems() {
    const items = await this.prisma.item.findMany({
      where: { isActive: true },
      include: {
        inventory: { select: { quantity: true } },
      },
    });

    return items
      .map((item) => {
        const totalStock = item.inventory.reduce(
          (sum, inv) => sum + inv.quantity,
          0,
        );
        const { inventory: _inv, ...rest } = item;
        return { ...rest, totalStock };
      })
      .filter((item) => item.totalStock <= item.minStockLevel);
  }

  // ─── STOCK MOVEMENT (ATOMIC) ───────────────────────────────

  async processStockMovement(
    payload: StockMovementPayload,
    tx: PrismaTx,
  ): Promise<{ newBalance: number; ledgerEntryId: string }> {
    const inventory = await tx.inventory.findUnique({
      where: {
        locationId_itemId: {
          locationId: payload.locationId,
          itemId: payload.itemId,
        },
      },
    });

    const currentQty = inventory?.quantity ?? 0;
    const currentCost = inventory?.unitCost ?? 0;

    const isIncoming = INCOMING_TYPES.includes(payload.movementType);
    const isAdjustment = payload.movementType === 'ADJUSTMENT';
    const reducesStock =
      (!isIncoming && !isAdjustment) ||
      (isAdjustment && payload.quantity < 0);

    if (reducesStock && !inventory) {
      throw new BadRequestException({
        code: ERROR_CODES.INV_002.code,
        message: ERROR_CODES.INV_002.message,
      });
    }

    let delta: number;
    if (isAdjustment) {
      delta = payload.quantity;
    } else if (isIncoming) {
      delta = Math.abs(payload.quantity);
    } else {
      delta = -Math.abs(payload.quantity);
    }

    const newBalance = currentQty + delta;
    if (newBalance < 0) {
      throw new BadRequestException({
        code: ERROR_CODES.INV_002.code,
        message: ERROR_CODES.INV_002.message,
      });
    }

    const incomingQty =
      isIncoming || (isAdjustment && payload.quantity > 0)
        ? Math.abs(isAdjustment ? payload.quantity : payload.quantity)
        : 0;

    let newUnitCost = currentCost;
    if (incomingQty > 0) {
      const incomingUnitCost =
        payload.unitCost !== undefined && payload.unitCost > 0
          ? payload.unitCost
          : currentCost;
      if (currentQty <= 0) {
        newUnitCost = incomingUnitCost;
      } else {
        const totalExistingValue = currentQty * currentCost;
        const incomingValue = incomingQty * incomingUnitCost;
        newUnitCost =
          newBalance > 0
            ? (totalExistingValue + incomingValue) / newBalance
            : incomingUnitCost;
      }
    }

    await tx.inventory.upsert({
      where: {
        locationId_itemId: {
          locationId: payload.locationId,
          itemId: payload.itemId,
        },
      },
      update: {
        quantity: newBalance,
        ...(incomingQty > 0 ? { unitCost: newUnitCost } : {}),
      },
      create: {
        locationId: payload.locationId,
        itemId: payload.itemId,
        quantity: newBalance,
        reservedQty: 0,
        unitCost:
          incomingQty > 0
            ? newUnitCost
            : (payload.unitCost ?? 0),
      },
    });

    const entry = await tx.stockLedger.create({
      data: {
        locationId: payload.locationId,
        itemId: payload.itemId,
        movementType: payload.movementType,
        quantity: delta,
        balanceAfter: newBalance,
        unitCost: newUnitCost,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        notes: payload.notes,
        createdBy: payload.createdBy,
      },
    });

    return { newBalance, ledgerEntryId: entry.id };
  }

  /**
   * Reserve stock for a confirmed order (no ledger row — not a movement).
   */
  async reserveStock(
    tx: PrismaTx,
    locationId: string,
    itemId: string,
    quantity: number,
  ): Promise<void> {
    const inv = await tx.inventory.findUnique({
      where: {
        locationId_itemId: { locationId, itemId },
      },
    });
    const available = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
    if (available < quantity) {
      throw new BadRequestException({
        code: ERROR_CODES.INV_002.code,
        message: ERROR_CODES.INV_002.message,
      });
    }
    await tx.inventory.update({
      where: { locationId_itemId: { locationId, itemId } },
      data: { reservedQty: { increment: quantity } },
    });
  }

  // ─── MOVE ORDERS ────────────────────────────────────────────

  async createMoveOrder(dto: CreateMoveOrderDto, creatorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const orderNumber = await nextYearlyFormattedIdTx(tx, 'MO', year);

      if (dto.fromLocationId) {
        const loc = await tx.location.findUnique({
          where: { id: dto.fromLocationId },
        });
        if (!loc || !loc.isActive) {
          throw new BadRequestException(
            'Invalid or inactive source location',
          );
        }
      }
      if (dto.toLocationId) {
        const loc = await tx.location.findUnique({
          where: { id: dto.toLocationId },
        });
        if (!loc || !loc.isActive) {
          throw new BadRequestException(
            'Invalid or inactive destination location',
          );
        }
      }

      for (const line of dto.lines) {
        const item = await tx.item.findUnique({
          where: { id: line.itemId },
        });
        if (!item || !item.isActive) {
          throw new BadRequestException(
            `Item ${line.itemId} not found or inactive`,
          );
        }
      }

      return tx.moveOrder.create({
        data: {
          orderNumber,
          type: dto.type,
          status: 'DRAFT',
          fromLocationId: dto.fromLocationId,
          toLocationId: dto.toLocationId,
          createdBy: creatorId,
          notes: dto.notes,
          lines: {
            create: dto.lines.map((line) => ({
              itemId: line.itemId,
              requestedQty: line.requestedQty,
            })),
          },
        },
        include: { lines: true },
      });
    });
  }

  async submitMoveOrder(orderId: string, userId: string) {
    const order = await this.prisma.moveOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException({
        code: ERROR_CODES.INV_005.code,
        message: ERROR_CODES.INV_005.message,
      });
    }
    if (order.status !== 'DRAFT') {
      throw new BadRequestException({
        code: ERROR_CODES.INV_006.code,
        message: ERROR_CODES.INV_006.message,
      });
    }

    const updated = await this.prisma.moveOrder.update({
      where: { id: orderId },
      data: { status: 'PENDING' },
      include: { lines: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'SUBMIT_MOVE_ORDER',
        entityType: 'MoveOrder',
        entityId: orderId,
        oldValues: { status: 'DRAFT' } as Prisma.InputJsonValue,
        newValues: { status: 'PENDING' } as Prisma.InputJsonValue,
      },
    });

    return updated;
  }

  async approveMoveOrder(orderId: string, approverId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.moveOrder.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException({
          code: ERROR_CODES.INV_005.code,
          message: ERROR_CODES.INV_005.message,
        });
      }
      if (order.status !== 'PENDING') {
        throw new BadRequestException({
          code: ERROR_CODES.INV_006.code,
          message: ERROR_CODES.INV_006.message,
        });
      }

      const needsReservation =
        order.type === 'SALE' || order.type === 'TRANSFER';

      if (needsReservation && order.fromLocationId) {
        for (const line of order.lines) {
          const inv = await tx.inventory.findUnique({
            where: {
              locationId_itemId: {
                locationId: order.fromLocationId,
                itemId: line.itemId,
              },
            },
          });

          const available =
            (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
          if (available < line.requestedQty) {
            throw new BadRequestException(
              `Insufficient available stock for item ${line.itemId}. ` +
                `Available: ${available}, Requested: ${line.requestedQty}`,
            );
          }

          await tx.inventory.update({
            where: {
              locationId_itemId: {
                locationId: order.fromLocationId,
                itemId: line.itemId,
              },
            },
            data: { reservedQty: { increment: line.requestedQty } },
          });
        }
      }

      const approved = await tx.moveOrder.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED',
          approvedBy: approverId,
          approvedAt: new Date(),
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId: approverId,
          action: 'APPROVE_MOVE_ORDER',
          entityType: 'MoveOrder',
          entityId: orderId,
          oldValues: { status: 'PENDING' } as Prisma.InputJsonValue,
          newValues: { status: 'APPROVED' } as Prisma.InputJsonValue,
        },
      });

      return approved;
    });
  }

  async dispatchMoveOrder(orderId: string, dispatcherId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.moveOrder.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException({
          code: ERROR_CODES.INV_005.code,
          message: ERROR_CODES.INV_005.message,
        });
      }
      if (order.status !== 'APPROVED') {
        throw new BadRequestException({
          code: ERROR_CODES.INV_006.code,
          message: ERROR_CODES.INV_006.message,
        });
      }

      const hasOutgoing =
        (order.type === 'SALE' || order.type === 'TRANSFER') &&
        order.fromLocationId;

      if (hasOutgoing) {
        const movementType: MovementType =
          order.type === 'TRANSFER' ? 'TRANSFER_OUT' : 'OUT';

        for (const line of order.lines) {
          await this.processStockMovement(
            {
              locationId: order.fromLocationId!,
              itemId: line.itemId,
              movementType,
              quantity: line.requestedQty,
              referenceType: 'MoveOrder',
              referenceId: order.id,
              createdBy: dispatcherId,
            },
            tx,
          );

          await tx.inventory.update({
            where: {
              locationId_itemId: {
                locationId: order.fromLocationId!,
                itemId: line.itemId,
              },
            },
            data: { reservedQty: { decrement: line.requestedQty } },
          });

          await tx.moveOrderLine.update({
            where: { id: line.id },
            data: { dispatchedQty: line.requestedQty },
          });
        }
      }

      const dispatched = await tx.moveOrder.update({
        where: { id: orderId },
        data: {
          status: 'IN_TRANSIT',
          dispatchedAt: new Date(),
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId: dispatcherId,
          action: 'DISPATCH_MOVE_ORDER',
          entityType: 'MoveOrder',
          entityId: orderId,
          oldValues: { status: 'APPROVED' } as Prisma.InputJsonValue,
          newValues: { status: 'IN_TRANSIT' } as Prisma.InputJsonValue,
        },
      });

      return dispatched;
    });
  }

  async completeMoveOrder(
    orderId: string,
    dto: CompleteMoveOrderDto,
    completerId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.moveOrder.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException({
          code: ERROR_CODES.INV_005.code,
          message: ERROR_CODES.INV_005.message,
        });
      }
      if (order.status !== 'IN_TRANSIT') {
        throw new BadRequestException({
          code: ERROR_CODES.INV_006.code,
          message: ERROR_CODES.INV_006.message,
        });
      }

      const hasIncoming =
        (order.type === 'TRANSFER' ||
          order.type === 'PURCHASE_RECEIVE' ||
          order.type === 'RETURN') &&
        order.toLocationId;

      if (hasIncoming) {
        const movementType: MovementType =
          order.type === 'TRANSFER'
            ? 'TRANSFER_IN'
            : order.type === 'RETURN'
              ? 'RETURN'
              : 'IN';

        for (const received of dto.receivedLines) {
          const line = order.lines.find((l) => l.id === received.lineId);
          if (!line) {
            throw new BadRequestException(
              `Line ${received.lineId} not found in this order`,
            );
          }

          await this.processStockMovement(
            {
              locationId: order.toLocationId!,
              itemId: line.itemId,
              movementType,
              quantity: received.receivedQty,
              referenceType: 'MoveOrder',
              referenceId: order.id,
              createdBy: completerId,
            },
            tx,
          );

          await tx.moveOrderLine.update({
            where: { id: line.id },
            data: { receivedQty: received.receivedQty },
          });
        }
      }

      const completed = await tx.moveOrder.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId: completerId,
          action: 'COMPLETE_MOVE_ORDER',
          entityType: 'MoveOrder',
          entityId: orderId,
          oldValues: { status: 'IN_TRANSIT' } as Prisma.InputJsonValue,
          newValues: { status: 'COMPLETED' } as Prisma.InputJsonValue,
        },
      });

      return completed;
    });
  }

  async cancelMoveOrder(orderId: string, cancellerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.moveOrder.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException({
          code: ERROR_CODES.INV_005.code,
          message: ERROR_CODES.INV_005.message,
        });
      }

      const cancellable: MoveOrderStatus[] = [
        'DRAFT',
        'PENDING',
        'APPROVED',
      ];
      if (!cancellable.includes(order.status)) {
        throw new BadRequestException({
          code: ERROR_CODES.INV_006.code,
          message: ERROR_CODES.INV_006.message,
        });
      }

      if (order.status === 'APPROVED' && order.fromLocationId) {
        for (const line of order.lines) {
          await tx.inventory.update({
            where: {
              locationId_itemId: {
                locationId: order.fromLocationId,
                itemId: line.itemId,
              },
            },
            data: { reservedQty: { decrement: line.requestedQty } },
          });
        }
      }

      const cancelled = await tx.moveOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
        include: { lines: true },
      });

      await tx.auditLog.create({
        data: {
          userId: cancellerId,
          action: 'CANCEL_MOVE_ORDER',
          entityType: 'MoveOrder',
          entityId: orderId,
          oldValues: { status: order.status } as Prisma.InputJsonValue,
          newValues: { status: 'CANCELLED' } as Prisma.InputJsonValue,
        },
      });

      return cancelled;
    });
  }

  // ─── STOCK LEDGER ──────────────────────────────────────────

  private buildLedgerWhere(
    query: LedgerQueryDto,
  ): Prisma.StockLedgerWhereInput {
    const { itemId, locationId, movementType, dateFrom, dateTo } = query;
    const where: Prisma.StockLedgerWhereInput = {};
    if (itemId) where.itemId = itemId;
    if (locationId) where.locationId = locationId;
    if (movementType) where.movementType = movementType;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    return where;
  }

  private escapeCsvCell(cell: string): string {
    if (/[",\n]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  async *streamLedgerCsv(
    query: LedgerQueryDto,
  ): AsyncGenerator<string, void, undefined> {
    const header =
      'Date,Item Code,Item Name,Location,Movement Type,Quantity,Unit Cost,Balance After,Reference,Notes\n';
    yield header;
    const where = this.buildLedgerWhere(query);
    let skip = 0;
    const take = 500;
    for (;;) {
      const batch = await this.prisma.stockLedger.findMany({
        where,
        include: {
          item: {
            select: { standardizedName: true, productCode: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      });
      if (batch.length === 0) break;
      const locIds = [...new Set(batch.map((b) => b.locationId))];
      const locs = await this.prisma.location.findMany({
        where: { id: { in: locIds } },
        select: { id: true, name: true },
      });
      const locMap = new Map(locs.map((l) => [l.id, l.name]));
      for (const row of batch) {
        const ref =
          [row.referenceType, row.referenceId].filter(Boolean).join(' ') || '';
        const line = [
          row.createdAt.toISOString(),
          row.item.productCode,
          row.item.standardizedName,
          locMap.get(row.locationId) ?? row.locationId,
          row.movementType,
          row.quantity,
          row.unitCost ?? '',
          row.balanceAfter,
          ref,
          (row.notes ?? '').replace(/\r|\n/g, ' '),
        ]
          .map((c) => this.escapeCsvCell(String(c)))
          .join(',');
        yield `${line}\n`;
      }
      skip += take;
    }
  }

  async getStockLedger(query: LedgerQueryDto) {
    const { page = 1, limit = 50 } = query;
    const where = this.buildLedgerWhere(query);

    const [entries, total] = await Promise.all([
      this.prisma.stockLedger.findMany({
        where,
        include: {
          item: {
            select: { standardizedName: true, productCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockLedger.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: entries,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  // ─── ADJUSTMENTS ───────────────────────────────────────────

  async createAdjustment(
    dto: StockAdjustmentDto,
    creatorId: string,
    creatorRole: string,
  ) {
    const autoApprove =
      creatorRole === 'ADMIN' || creatorRole === 'MANAGER';

    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          itemId: dto.itemId,
          locationId: dto.locationId,
          quantity: dto.quantity,
          reason: dto.reason,
          notes: dto.notes,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          createdBy: creatorId,
          approvedBy: autoApprove ? creatorId : undefined,
        },
      });

      if (autoApprove) {
        await this.processStockMovement(
          {
            locationId: dto.locationId,
            itemId: dto.itemId,
            movementType: 'ADJUSTMENT',
            quantity: dto.quantity,
            referenceType: 'StockAdjustment',
            referenceId: adjustment.id,
            notes: dto.notes,
            createdBy: creatorId,
          },
          tx,
        );
      }

      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'CREATE_ADJUSTMENT',
          entityType: 'StockAdjustment',
          entityId: adjustment.id,
          newValues: {
            itemId: dto.itemId,
            locationId: dto.locationId,
            quantity: dto.quantity,
            reason: dto.reason,
            status: autoApprove ? 'APPROVED' : 'PENDING',
          } as Prisma.InputJsonValue,
        },
      });

      return adjustment;
    });
  }

  async approveAdjustment(adjustmentId: string, approverId: string) {
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.findUnique({
        where: { id: adjustmentId },
      });
      if (!adjustment) {
        throw new NotFoundException(
          `Adjustment ${adjustmentId} not found`,
        );
      }
      if (adjustment.status !== 'PENDING') {
        throw new BadRequestException(
          'Only PENDING adjustments can be approved',
        );
      }

      await this.processStockMovement(
        {
          locationId: adjustment.locationId,
          itemId: adjustment.itemId,
          movementType: 'ADJUSTMENT',
          quantity: adjustment.quantity,
          referenceType: 'StockAdjustment',
          referenceId: adjustment.id,
          notes: adjustment.notes ?? undefined,
          createdBy: approverId,
        },
        tx,
      );

      return tx.stockAdjustment.update({
        where: { id: adjustmentId },
        data: {
          status: 'APPROVED',
          approvedBy: approverId,
        },
      });
    });
  }

  async rejectAdjustment(adjustmentId: string, _rejecterId: string) {
    const adjustment = await this.prisma.stockAdjustment.findUnique({
      where: { id: adjustmentId },
    });
    if (!adjustment) {
      throw new NotFoundException(
        `Adjustment ${adjustmentId} not found`,
      );
    }
    if (adjustment.status !== 'PENDING') {
      throw new BadRequestException(
        'Only PENDING adjustments can be rejected',
      );
    }

    return this.prisma.stockAdjustment.update({
      where: { id: adjustmentId },
      data: { status: 'REJECTED' },
    });
  }

  // ─── LOCATIONS ──────────────────────────────────────────────

  async getLocations() {
    return this.prisma.location.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(dto: CreateLocationDto, creatorId: string) {
    const [byName, byCode] = await Promise.all([
      this.prisma.location.findUnique({ where: { name: dto.name } }),
      this.prisma.location.findUnique({ where: { code: dto.code } }),
    ]);

    if (byName) {
      throw new ConflictException(
        `Location name "${dto.name}" already exists`,
      );
    }
    if (byCode) {
      throw new ConflictException(
        `Location code "${dto.code}" already exists`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const location = await tx.location.create({ data: dto });

      const activeItems = await tx.item.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      if (activeItems.length > 0) {
        await tx.inventory.createMany({
          data: activeItems.map((item) => ({
            locationId: location.id,
            itemId: item.id,
            quantity: 0,
            reservedQty: 0,
            unitCost: 0,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: creatorId,
          action: 'CREATE_LOCATION',
          entityType: 'Location',
          entityId: location.id,
          newValues: {
            name: dto.name,
            code: dto.code,
            type: dto.type,
          } as Prisma.InputJsonValue,
        },
      });

      return location;
    });
  }
}
