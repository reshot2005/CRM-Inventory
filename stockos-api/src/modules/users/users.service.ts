import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  twoFactorEnabled: true,
  allowedLocations: true,
  rejectionReason: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  approvedBy: true,
  approvedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    status?: UserStatus;
    role?: UserRole;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, role, search, page = 1, limit = 20 } = query;
    const where: Prisma.UserWhereInput = {};

    if (status) where.status = status;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
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

  async findPending() {
    return this.prisma.user.findMany({
      where: { status: 'PENDING' },
      select: USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async approve(adminId: string, userId: string, role: UserRole) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING users can be approved');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          role,
          approvedBy: adminId,
          approvedAt: new Date(),
        },
        select: USER_SELECT,
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'APPROVE_USER',
          entityType: 'User',
          entityId: userId,
          oldValues: { status: user.status, role: user.role },
          newValues: { status: 'ACTIVE', role },
        },
      });

      return updated;
    });
  }

  async reject(adminId: string, userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING users can be rejected');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
        },
        select: USER_SELECT,
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'REJECT_USER',
          entityType: 'User',
          entityId: userId,
          oldValues: { status: user.status },
          newValues: { status: 'REJECTED', rejectionReason: reason },
        },
      });

      return updated;
    });
  }

  async suspend(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    return this.prisma.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId } });

      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: 'SUSPENDED' },
        select: USER_SELECT,
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'SUSPEND_USER',
          entityType: 'User',
          entityId: userId,
          oldValues: { status: user.status },
          newValues: { status: 'SUSPENDED' },
        },
      });

      return updated;
    });
  }

  async update(adminId: string, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const oldValues: Record<string, unknown> = {};
    const newValues: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      oldValues.name = user.name;
      newValues.name = dto.name;
    }
    if (dto.role !== undefined) {
      oldValues.role = user.role;
      newValues.role = dto.role;
    }
    if (dto.allowedLocations !== undefined) {
      oldValues.allowedLocations = user.allowedLocations;
      newValues.allowedLocations = dto.allowedLocations;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name,
          role: dto.role,
          allowedLocations: dto.allowedLocations,
        },
        select: USER_SELECT,
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'UPDATE_USER',
          entityType: 'User',
          entityId: userId,
          oldValues: oldValues as Prisma.InputJsonValue,
          newValues: newValues as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  async delete(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          action: 'DELETE_USER',
          entityType: 'User',
          entityId: userId,
          oldValues: {
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
          },
        },
      });
    });

    return { message: 'User deleted successfully' };
  }
}
