import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationMeta } from '../../common/types/api-response.type';
import { nextPaddedGlobalIdTx } from '../../common/utils/sequence.util';
import { CreateVendorDto, UpdateVendorDto } from './dto/create-vendor.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateActivityDto } from './dto/customer-activity.dto';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  //  VENDORS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAllVendors(query: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ vendors: Record<string, unknown>[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.VendorWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { companyName: { contains: term, mode: 'insensitive' } },
        { vendorId: { contains: term, mode: 'insensitive' } },
        { gstin: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [vendors, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: limit,
        include: {
          contacts: true,
          _count: { select: { items: true, purchaseOrders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return {
      vendors,
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

  async getVendorById(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        contacts: true,
        items: {
          include: {
            item: {
              select: {
                id: true,
                standardizedName: true,
                productCode: true,
                category: true,
              },
            },
          },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async createVendor(dto: CreateVendorDto, userId: string) {
    const vendor = await this.prisma.$transaction(async (tx) => {
      const vendorId = await this.generateVendorId(tx);

      const created = await tx.vendor.create({
        data: {
          vendorId,
          companyName: dto.companyName,
          gstin: dto.gstin ?? null,
          pan: dto.pan ?? null,
          paymentTerms: dto.paymentTerms ?? 'NET_30',
          creditLimit: dto.creditLimit ?? null,
          remarks: dto.remarks ?? null,
          contacts: dto.contacts
            ? {
                create: dto.contacts.map((c) => ({
                  name: c.name,
                  role: c.role ?? null,
                  phones: c.phones,
                  email: c.email ?? null,
                  isPrimary: c.isPrimary ?? false,
                })),
              }
            : undefined,
        },
        include: { contacts: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entityType: 'Vendor',
          entityId: created.id,
          newValues: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    this.logger.log(`Vendor created: ${vendor.vendorId} — ${vendor.companyName}`);
    return vendor;
  }

  async updateVendor(id: string, dto: UpdateVendorDto, userId: string) {
    const existing = await this.prisma.vendor.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.vendor.update({
        where: { id },
        data: {
          companyName: dto.companyName,
          gstin: dto.gstin,
          pan: dto.pan,
          paymentTerms: dto.paymentTerms,
          creditLimit: dto.creditLimit,
          remarks: dto.remarks,
          isActive: dto.isActive,
        },
        include: { contacts: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entityType: 'Vendor',
          entityId: id,
          oldValues: existing as unknown as Prisma.InputJsonValue,
          newValues: result as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });

    this.logger.log(`Vendor updated: ${updated.vendorId}`);
    return updated;
  }

  async addVendorContact(vendorId: string, dto: CreateContactDto, userId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    const contact = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.vendorContact.updateMany({
          where: { vendorId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await tx.vendorContact.create({
        data: {
          vendorId,
          name: dto.name,
          role: dto.role ?? null,
          phones: dto.phones,
          email: dto.email ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ADD_CONTACT',
          entityType: 'Vendor',
          entityId: vendorId,
          newValues: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return contact;
  }

  async deleteVendorContact(vendorId: string, contactId: string, userId: string) {
    const contact = await this.prisma.vendorContact.findFirst({
      where: { id: contactId, vendorId },
    });
    if (!contact) {
      throw new NotFoundException('Vendor contact not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.vendorContact.delete({ where: { id: contactId } });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE_CONTACT',
          entityType: 'Vendor',
          entityId: vendorId,
          oldValues: contact as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return { message: 'Contact deleted' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  CUSTOMERS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAllCustomers(query: {
    search?: string;
    type?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ customers: Record<string, unknown>[]; meta: PaginationMeta }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.type) {
      where.type = query.type as Prisma.EnumCustomerTypeFilter['equals'];
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { primaryContact: { contains: term, mode: 'insensitive' } },
        { companyName: { contains: term, mode: 'insensitive' } },
        { customerId: { contains: term, mode: 'insensitive' } },
        { gstin: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          contacts: true,
          _count: { select: { saleOrders: true, activityLog: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      customers,
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

  async getCustomerById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: true,
        activityLog: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        saleOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async createCustomer(dto: CreateCustomerDto, userId: string) {
    const customer = await this.prisma.$transaction(async (tx) => {
      const customerId = await this.generateCustomerId(tx);

      const created = await tx.customer.create({
        data: {
          customerId,
          type: dto.type ?? 'BUSINESS',
          companyName: dto.companyName ?? null,
          primaryContact: dto.primaryContact,
          phones: dto.phones,
          address: dto.address ?? null,
          gmapsPlaceId: dto.gmapsPlaceId ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          gstin: dto.gstin ?? null,
          pan: dto.pan ?? null,
          paymentTerms: dto.paymentTerms ?? 'NET_30',
          creditLimit: dto.creditLimit ?? null,
          contacts: dto.contacts
            ? {
                create: dto.contacts.map((c) => ({
                  name: c.name,
                  role: c.role ?? null,
                  phones: c.phones,
                  email: c.email ?? null,
                  isPrimary: c.isPrimary ?? false,
                })),
              }
            : undefined,
        },
        include: { contacts: true },
      });

      await tx.customerActivity.create({
        data: {
          customerId: created.id,
          type: 'SYSTEM',
          content: `Customer created with ID ${customerId}`,
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          entityType: 'Customer',
          entityId: created.id,
          newValues: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    this.logger.log(`Customer created: ${customer.customerId} — ${customer.primaryContact}`);
    return customer;
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto, userId: string) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Customer not found');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customer.update({
        where: { id },
        data: {
          type: dto.type,
          companyName: dto.companyName,
          primaryContact: dto.primaryContact,
          phones: dto.phones,
          address: dto.address,
          gmapsPlaceId: dto.gmapsPlaceId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          gstin: dto.gstin,
          pan: dto.pan,
          paymentTerms: dto.paymentTerms,
          creditLimit: dto.creditLimit,
          isActive: dto.isActive,
        },
        include: { contacts: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'UPDATE',
          entityType: 'Customer',
          entityId: id,
          oldValues: existing as unknown as Prisma.InputJsonValue,
          newValues: result as unknown as Prisma.InputJsonValue,
        },
      });

      return result;
    });

    this.logger.log(`Customer updated: ${updated.customerId}`);
    return updated;
  }

  async addCustomerContact(customerId: string, dto: CreateContactDto, userId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const contact = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { customerId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await tx.customerContact.create({
        data: {
          customerId,
          name: dto.name,
          role: dto.role ?? null,
          phones: dto.phones,
          email: dto.email ?? null,
          isPrimary: dto.isPrimary ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'ADD_CONTACT',
          entityType: 'Customer',
          entityId: customerId,
          newValues: created as unknown as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return contact;
  }

  async deleteCustomerContact(customerId: string, contactId: string, userId: string) {
    const contact = await this.prisma.customerContact.findFirst({
      where: { id: contactId, customerId },
    });
    if (!contact) {
      throw new NotFoundException('Customer contact not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customerContact.delete({ where: { id: contactId } });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'DELETE_CONTACT',
          entityType: 'Customer',
          entityId: customerId,
          oldValues: contact as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return { message: 'Contact deleted' };
  }

  // ─── Customer Activities ───────────────────────────────────────────────────

  async getCustomerActivities(customerId: string, query: { page?: number; limit?: number }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.customerActivity.findMany({
        where: { customerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customerActivity.count({ where: { customerId } }),
    ]);

    return {
      activities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
      } satisfies PaginationMeta,
    };
  }

  async addCustomerActivity(customerId: string, dto: CreateActivityDto, userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customerActivity.create({
      data: {
        customerId,
        type: dto.type,
        content: dto.content,
        createdBy: userId,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  ID GENERATORS
  // ═══════════════════════════════════════════════════════════════════════════

  private async generateVendorId(tx: Prisma.TransactionClient): Promise<string> {
    return nextPaddedGlobalIdTx(tx, 'VEN', 'VEN');
  }

  private async generateCustomerId(tx: Prisma.TransactionClient): Promise<string> {
    return nextPaddedGlobalIdTx(tx, 'CUS', 'CUS');
  }
}
