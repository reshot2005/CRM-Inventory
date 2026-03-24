import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/types/user-role.enum';
import { ReportsService } from './reports.service';

@Controller('reports')
@ApiTags('reports')
@ApiBearerAuth('access-token')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  async getDashboardKPIs() {
    return this.reportsService.getDashboardKPIs();
  }

  @Get('stock-summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get stock summary by category and location' })
  async getStockSummary() {
    return this.reportsService.getStockSummary();
  }

  @Get('low-stock')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get low stock report' })
  async getLowStockReport() {
    return this.reportsService.getLowStockReport();
  }

  @Get('stock-valuation')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get stock valuation report' })
  async getStockValuation() {
    return this.reportsService.getStockValuation();
  }

  @Get('movement-trend')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get stock movement trend' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to look back (default 30)',
  })
  async getMovementTrend(@Query('days') days?: number) {
    return this.reportsService.getMovementTrend(days ?? 30);
  }

  @Get('sales-summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get sales summary' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getSalesSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getSalesSummary(from, to);
  }

  @Get('purchase-summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get purchase order summary' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getPurchaseSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getPurchaseSummary(from, to);
  }

  @Get('production-summary')
  @RequirePermissions(PERMISSIONS.REPORTS_READ)
  @ApiOperation({ summary: 'Get production summary' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getProductionSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getProductionSummary(from, to);
  }

  @Get('audit-log')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Get audit log entries' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAuditLog(
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getAuditLog({
      userId,
      entityType,
      page,
      limit,
    });
  }
}
