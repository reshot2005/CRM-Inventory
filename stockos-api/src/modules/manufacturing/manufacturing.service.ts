import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemCategory,
  MovementType,
  Prisma,
  ProductionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationMeta } from '../../common/types/api-response.type';
import { nextYearlyFormattedIdTx } from '../../common/utils/sequence.util';
import { InventoryService } from '../inventory/inventory.service';
import { CreateBOMDto, UpdateBOMDto } from './dto/create-bom.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';

@Injectable()
export class ManufacturingService {
  private readonly logger = new Logger(ManufacturingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  //  BOMs
  // ═══════════════════════════════════════════════════════════════════════════

  async getAllBOMs(query: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ boms: Record<string, unknown>[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.BOMWhereInput = { isActive: true };

    if (query.search) {
      const term = query.search.trim();
      where.item = {
        OR: [
          { standardizedName: { contains: term, mode: 'insensitive' } },
          { productCode: { contains: term, mode: 'insensitive' } },
        ],
      };
    }

    const [boms, total] = await Promise.all([
      this.prisma.bOM.findMany({
        where,
        skip,
        take: limit,
        include: {
          item: {
            select: {
              id: true,
              standardizedName: true,
              productCode: true,
              category: true,
            },
          },
          lines: {
            include: {
              rawMaterial: {
                select: {
                  id: true,
                  standardizedName: true,
                  productCode: true,
                  category: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bOM.count({ where }),
    ]);

    return {
      boms,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getBOMById(id: string) {
    const bom = await this.prisma.bOM.findUnique({
      where: { id },
      include: {
        item: {
          select: {
            id: true,
            standardizedName: true,
            productCode: true,
            category: true,
            brand: true,
          },
        },
        lines: {
          include: {
            rawMaterial: {
              select: {
                id: true,
                standardizedName: true,
                productCode: true,
                category: true,
                brand: true,
              },
            },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundException('BOM not found');
    }

    return bom;
  }

  async createBOM(dto: CreateBOMDto, userId: string) {
    const finishedGood = await this.prisma.item.findUnique({
      where: { id: dto.finishedGoodId },
    });

    if (!finishedGood) {
      throw new NotFoundException('Finished good item not found');
    }
    if (finishedGood.category !== ItemCategory.FINISHED_GOOD) {
      throw new BadRequestException(
        `Item "${finishedGood.standardizedName}" is not a FINISHED_GOOD (got ${finishedGood.category})`,
      );
    }

    const rawMaterialIds = dto.lines.map((l) => l.rawMaterialId);
    const rawMaterials = await this.prisma.item.findMany({
      where: { id: { in: rawMaterialIds } },
      select: { id: true, category: true, standardizedName: true },
    });

    const rmMap = new Map(rawMaterials.map((r) => [r.id, r]));
    for (const line of dto.lines) {
      const rm = rmMap.get(line.rawMaterialId);
      if (!rm) {
        throw new NotFoundException(`Raw material "${line.rawMaterialId}" not found`);
      }
      if (rm.category !== ItemCategory.RAW_MATERIAL) {
        throw new BadRequestException(
          `Item "${rm.standardizedName}" is not a RAW_MATERIAL (got ${rm.category})`,
        );
      }
    }

    const bom = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bOM.create({
        data: {
          finishedGoodId: dto.finishedGoodId,
          version: dto.version ?? '1.0',
          yieldQty: dto.yieldQty ?? 1,
          yieldUnit: dto.yieldUnit ?? 'unit',
          notes: dto.notes ?? null,
          lines: {
            create: dto.lines.map((l) => ({
              rawMaterialId: l.rawMaterialId,
              quantity: l.quantity,
              unit: l.unit,
              wastePercent: l.wastePercent ?? 0,
            })),
          },
        },
        include: {
          item: {
            select: { id: true, standardizedName: true, productCode: true },
          },
          lines: {
            include: {
              rawMaterial: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entityType: 'BOM',
          entityId: created.id,
          newValues: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    this.logger.log(`BOM created: ${bom.id} for item ${dto.finishedGoodId}`);
    return bom;
  }

  async updateBOM(id: string, dto: UpdateBOMDto, userId: string) {
    const existing = await this.prisma.bOM.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!existing) {
      throw new NotFoundException('BOM not found');
    }

    if (dto.lines) {
      const rawMaterialIds = dto.lines.map((l) => l.rawMaterialId);
      const rawMaterials = await this.prisma.item.findMany({
        where: { id: { in: rawMaterialIds } },
        select: { id: true, category: true, standardizedName: true },
      });

      const rmMap = new Map(rawMaterials.map((r) => [r.id, r]));
      for (const line of dto.lines) {
        const rm = rmMap.get(line.rawMaterialId);
        if (!rm) {
          throw new NotFoundException(`Raw material "${line.rawMaterialId}" not found`);
        }
        if (rm.category !== ItemCategory.RAW_MATERIAL) {
          throw new BadRequestException(
            `Item "${rm.standardizedName}" is not a RAW_MATERIAL (got ${rm.category})`,
          );
        }
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.bOMLine.deleteMany({ where: { bomId: id } });
        await tx.bOMLine.createMany({
          data: dto.lines.map((l) => ({
            bomId: id,
            rawMaterialId: l.rawMaterialId,
            quantity: l.quantity,
            unit: l.unit,
            wastePercent: l.wastePercent ?? 0,
          })),
        });
      }

      const result = await tx.bOM.update({
        where: { id },
        data: {
          version: dto.version,
          yieldQty: dto.yieldQty,
          yieldUnit: dto.yieldUnit,
          notes: dto.notes,
        },
        include: {
          item: {
            select: { id: true, standardizedName: true, productCode: true },
          },
          lines: {
            include: {
              rawMaterial: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entityType: 'BOM',
          entityId: id,
          oldValues: existing as unknown as Prisma.InputJsonValue,
          newValues: result as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });

    this.logger.log(`BOM updated: ${id}`);
    return updated;
  }

  async deleteBOM(id: string, userId: string): Promise<void> {
    const bom = await this.prisma.bOM.findUnique({ where: { id } });
    if (!bom) {
      throw new NotFoundException('BOM not found');
    }

    const activeOrders = await this.prisma.productionOrder.findFirst({
      where: {
        bomId: id,
        status: {
          in: [
            ProductionStatus.PLANNED,
            ProductionStatus.IN_PROGRESS,
            ProductionStatus.PAUSED,
          ],
        },
      },
    });

    if (activeOrders) {
      throw new BadRequestException(
        'Cannot delete BOM with active production orders',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bOM.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'SOFT_DELETE',
          entityType: 'BOM',
          entityId: id,
          oldValues: { isActive: true } as Prisma.InputJsonValue,
          newValues: { isActive: false } as Prisma.InputJsonValue,
        },
      });
    });

    this.logger.log(`BOM soft-deleted: ${id}`);
  }

  async calculateBOMRequirements(bomId: string, targetQty: number) {
    const bom = await this.prisma.bOM.findUnique({
      where: { id: bomId },
      include: {
        item: {
          select: { id: true, standardizedName: true, productCode: true },
        },
        lines: {
          include: {
            rawMaterial: {
              select: { id: true, standardizedName: true, productCode: true },
            },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundException('BOM not found');
    }

    const requirements = await Promise.all(
      bom.lines.map(async (line) => {
        const requiredQty =
          line.quantity * targetQty * (1 + line.wastePercent / 100);

        const inventories = await this.prisma.inventory.findMany({
          where: { itemId: line.rawMaterialId },
          select: { quantity: true, reservedQty: true },
        });

        const currentStock = inventories.reduce(
          (sum, inv) => sum + inv.quantity - inv.reservedQty,
          0,
        );

        return {
          rawMaterial: line.rawMaterial,
          unit: line.unit,
          baseQtyPerUnit: line.quantity,
          wastePercent: line.wastePercent,
          requiredQty: Math.round(requiredQty * 1000) / 1000,
          currentStock: Math.round(currentStock * 1000) / 1000,
          shortfall: Math.max(0, Math.round((requiredQty - currentStock) * 1000) / 1000),
          sufficient: currentStock >= requiredQty,
        };
      }),
    );

    const maxProducible = requirements.length > 0
      ? Math.floor(
          Math.min(
            ...requirements.map((r) => {
              const effectiveQtyPerUnit =
                r.baseQtyPerUnit * (1 + r.wastePercent / 100);
              return effectiveQtyPerUnit > 0
                ? r.currentStock / effectiveQtyPerUnit
                : 0;
            }),
          ),
        )
      : 0;

    return {
      bom: {
        id: bom.id,
        finishedGood: bom.item,
        version: bom.version,
        yieldQty: bom.yieldQty,
        yieldUnit: bom.yieldUnit,
      },
      targetQty,
      requirements,
      maxProducible: Math.max(0, maxProducible),
      allSufficient: requirements.every((r) => r.sufficient),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PRODUCTION ORDERS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAllProductionOrders(query: {
    status?: ProductionStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: Record<string, unknown>[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.ProductionOrderWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { batchNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          bom: {
            include: {
              item: {
                select: {
                  id: true,
                  standardizedName: true,
                  productCode: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.productionOrder.count({ where }),
    ]);

    return {
      orders,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      },
    };
  }

  async getProductionOrderById(id: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        bom: {
          include: {
            item: {
              select: {
                id: true,
                standardizedName: true,
                productCode: true,
              },
            },
            lines: {
              include: {
                rawMaterial: {
                  select: {
                    id: true,
                    standardizedName: true,
                    productCode: true,
                  },
                },
              },
            },
          },
        },
        materialLines: {
          include: {
            rawMaterial: {
              select: {
                id: true,
                standardizedName: true,
                productCode: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Production order not found');
    }

    return order;
  }

  async createProductionOrder(dto: CreateProductionOrderDto, userId: string) {
    const bom = await this.prisma.bOM.findUnique({
      where: { id: dto.bomId },
      include: { lines: true },
    });

    if (!bom) {
      throw new NotFoundException('BOM not found');
    }
    if (!bom.isActive) {
      throw new BadRequestException('BOM is not active');
    }

    const location = await this.prisma.location.findUnique({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const orderNumber = await nextYearlyFormattedIdTx(tx, 'PRD', year);

      const materialLines = bom.lines.map((line) => ({
        rawMaterialId: line.rawMaterialId,
        requiredQty:
          line.quantity * dto.targetQty * (1 + line.wastePercent / 100),
      }));

      const created = await tx.productionOrder.create({
        data: {
          orderNumber,
          bomId: dto.bomId,
          targetQty: dto.targetQty,
          status: ProductionStatus.PLANNED,
          deadline: dto.deadline ? new Date(dto.deadline) : null,
          batchNumber: dto.batchNumber ?? null,
          notes: dto.notes ?? null,
          createdBy: userId,
          materialLines: {
            create: materialLines,
          },
        },
        include: {
          bom: {
            include: {
              item: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
          materialLines: {
            include: {
              rawMaterial: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entityType: 'ProductionOrder',
          entityId: created.id,
          newValues: {
            orderNumber,
            bomId: dto.bomId,
            targetQty: dto.targetQty,
            status: ProductionStatus.PLANNED,
          } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    this.logger.log(`Production order created: ${order.orderNumber}`);
    return order;
  }

  async startProduction(id: string, userId: string, locationId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: { materialLines: true },
    });

    if (!order) {
      throw new NotFoundException('Production order not found');
    }
    if (order.status !== ProductionStatus.PLANNED) {
      throw new BadRequestException(
        `Cannot start production in ${order.status} status. Must be PLANNED.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const ml of order.materialLines) {
        const inventory = await tx.inventory.findUnique({
          where: {
            locationId_itemId: {
              locationId,
              itemId: ml.rawMaterialId,
            },
          },
        });

        if (!inventory) {
          throw new BadRequestException(
            `No inventory found for raw material ${ml.rawMaterialId} at location ${locationId}`,
          );
        }

        const available = inventory.quantity - inventory.reservedQty;
        if (available < ml.requiredQty) {
          throw new BadRequestException(
            `Insufficient stock for material ${ml.rawMaterialId}. Available: ${available}, Required: ${ml.requiredQty}`,
          );
        }

        await tx.inventory.update({
          where: { id: inventory.id },
          data: { reservedQty: { increment: ml.requiredQty } },
        });
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
        include: {
          bom: {
            include: {
              item: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
          materialLines: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'START_PRODUCTION',
          entityType: 'ProductionOrder',
          entityId: id,
          oldValues: { status: ProductionStatus.PLANNED } as Prisma.InputJsonValue,
          newValues: { status: ProductionStatus.IN_PROGRESS, locationId } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    this.logger.log(`Production started: ${order.orderNumber}`);
    return result;
  }

  async completeProduction(
    id: string,
    dto: CompleteProductionDto,
    userId: string,
  ) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: {
        bom: { include: { item: true } },
        materialLines: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Production order not found');
    }
    if (order.status !== ProductionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete production in ${order.status} status. Must be IN_PROGRESS.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      for (const consumed of dto.consumedMaterials) {
        const materialLine = order.materialLines.find(
          (ml) => ml.rawMaterialId === consumed.rawMaterialId,
        );

        if (!materialLine) {
          throw new BadRequestException(
            `Raw material ${consumed.rawMaterialId} not found in production order materials`,
          );
        }

        const invBefore = await tx.inventory.findUnique({
          where: {
            locationId_itemId: {
              locationId: dto.locationId,
              itemId: consumed.rawMaterialId,
            },
          },
        });

        if (!invBefore) {
          throw new BadRequestException(
            `No inventory for material ${consumed.rawMaterialId} at location ${dto.locationId}`,
          );
        }

        await this.inventoryService.processStockMovement(
          {
            locationId: dto.locationId,
            itemId: consumed.rawMaterialId,
            movementType: MovementType.PRODUCTION_OUT,
            quantity: consumed.consumedQty,
            referenceType: 'ProductionOrder',
            referenceId: order.id,
            notes: `Consumed for ${order.orderNumber}`,
            createdBy: userId,
            unitCost: invBefore.unitCost,
          },
          tx,
        );

        const invAfter = await tx.inventory.findUnique({
          where: {
            locationId_itemId: {
              locationId: dto.locationId,
              itemId: consumed.rawMaterialId,
            },
          },
        });
        if (invAfter) {
          await tx.inventory.update({
            where: { id: invAfter.id },
            data: {
              reservedQty: Math.max(
                0,
                invAfter.reservedQty - materialLine.requiredQty,
              ),
            },
          });
        }

        const variance = materialLine.requiredQty - consumed.consumedQty;
        await tx.productionMaterialLine.update({
          where: { id: materialLine.id },
          data: {
            consumedQty: consumed.consumedQty,
            variance,
          },
        });
      }

      await this.inventoryService.processStockMovement(
        {
          locationId: dto.locationId,
          itemId: order.bom.finishedGoodId,
          movementType: MovementType.PRODUCTION_IN,
          quantity: dto.actualQty,
          referenceType: 'ProductionOrder',
          referenceId: order.id,
          notes: `Produced by ${order.orderNumber}`,
          createdBy: userId,
        },
        tx,
      );

      const yieldPct =
        order.targetQty > 0 ? (dto.actualQty / order.targetQty) * 100 : 0;

      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          status: ProductionStatus.COMPLETED,
          actualQty: dto.actualQty,
          completedAt: new Date(),
        },
        include: {
          bom: {
            include: {
              item: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
          materialLines: {
            include: {
              rawMaterial: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'COMPLETE_PRODUCTION',
          entityType: 'ProductionOrder',
          entityId: id,
          oldValues: { status: ProductionStatus.IN_PROGRESS } as Prisma.InputJsonValue,
          newValues: {
            status: ProductionStatus.COMPLETED,
            actualQty: dto.actualQty,
            yieldPct,
            consumedMaterials: dto.consumedMaterials,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    this.logger.log(
      `Production completed: ${order.orderNumber}, produced ${dto.actualQty}`,
    );
    return result;
  }

  async cancelProduction(id: string, userId: string) {
    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: { materialLines: true },
    });

    if (!order) {
      throw new NotFoundException('Production order not found');
    }

    const cancellable: ProductionStatus[] = [
      ProductionStatus.PLANNED,
      ProductionStatus.IN_PROGRESS,
      ProductionStatus.PAUSED,
    ];
    if (!cancellable.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel production in ${order.status} status`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (order.status === ProductionStatus.IN_PROGRESS) {
        const inventories = await tx.inventory.findMany({
          where: {
            itemId: { in: order.materialLines.map((ml) => ml.rawMaterialId) },
          },
        });

        const invMap = new Map(
          inventories.map((inv) => [`${inv.locationId}:${inv.itemId}`, inv]),
        );

        for (const ml of order.materialLines) {
          for (const inv of inventories.filter(
            (i) => i.itemId === ml.rawMaterialId,
          )) {
            const newReserved = Math.max(0, inv.reservedQty - ml.requiredQty);
            await tx.inventory.update({
              where: { id: inv.id },
              data: { reservedQty: newReserved },
            });
          }
        }
      }

      const updated = await tx.productionOrder.update({
        where: { id },
        data: { status: ProductionStatus.CANCELLED },
        include: {
          bom: {
            include: {
              item: {
                select: { id: true, standardizedName: true, productCode: true },
              },
            },
          },
          materialLines: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CANCEL_PRODUCTION',
          entityType: 'ProductionOrder',
          entityId: id,
          oldValues: { status: order.status } as Prisma.InputJsonValue,
          newValues: { status: ProductionStatus.CANCELLED } as Prisma.InputJsonValue,
        },
      });

      return updated;
    });

    this.logger.log(`Production cancelled: ${order.orderNumber}`);
    return result;
  }

  async getProductionSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [statusCounts, todayCompletions] = await Promise.all([
      this.prisma.productionOrder.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.productionOrder.count({
        where: {
          status: ProductionStatus.COMPLETED,
          completedAt: { gte: todayStart },
        },
      }),
    ]);

    const countsMap: Record<string, number> = {};
    for (const sc of statusCounts) {
      countsMap[sc.status] = sc._count.id;
    }

    return {
      byStatus: {
        planned: countsMap[ProductionStatus.PLANNED] ?? 0,
        inProgress: countsMap[ProductionStatus.IN_PROGRESS] ?? 0,
        paused: countsMap[ProductionStatus.PAUSED] ?? 0,
        completed: countsMap[ProductionStatus.COMPLETED] ?? 0,
        blocked: countsMap[ProductionStatus.BLOCKED] ?? 0,
        cancelled: countsMap[ProductionStatus.CANCELLED] ?? 0,
      },
      todayCompletions,
      total: Object.values(countsMap).reduce((a, b) => a + b, 0),
    };
  }

}
