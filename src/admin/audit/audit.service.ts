import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateAuditLogParams {
  adminId?: string;
  adminName?: string;
  action: string;
  method: string;
  path: string;
  entityType?: string;
  entityId?: string;
  changes?: any;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
}

interface FindAllParams {
  adminId?: string;
  entityType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateAuditLogParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          adminId: params.adminId,
          adminName: params.adminName,
          action: params.action,
          method: params.method,
          path: params.path,
          entityType: params.entityType,
          entityId: params.entityId,
          changes: params.changes ?? Prisma.JsonNull,
          ip: params.ip,
          userAgent: params.userAgent,
          statusCode: params.statusCode,
        },
      });
    } catch (error) {
      // Audit не должен ломать основной flow
      this.logger.error(`Не удалось записать аудит: ${error.message}`);
      return null;
    }
  }

  async findAll(params: FindAllParams) {
    const {
      adminId,
      entityType,
      action,
      dateFrom,
      dateTo,
      page = 1,
      limit = 50,
    } = params;

    const where: Prisma.AuditLogWhereInput = {};
    if (adminId) where.adminId = adminId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
