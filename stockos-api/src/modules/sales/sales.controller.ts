import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { SaleOrderStatus, ChallanStatus } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/types/user-role.enum';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { SalesService } from './sales.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { CreateSaleOrderDto } from './dto/create-sale-order.dto';
import { CreateChallanDto } from './dto/create-challan.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

// ── Purchase Orders ───────────────────────

@Controller('purchase-orders')
@ApiTags('purchase-orders')
@ApiBearerAuth('access-token')
export class PurchaseOrdersController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'List all purchase orders' })
  @ApiQuery({ name: 'vendorId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAll(
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.getAllPurchaseOrders({
      vendorId,
      status,
      from,
      to,
      page,
      limit,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Get purchase order by ID' })
  async getById(@Param('id') id: string) {
    return this.salesService.getPurchaseOrderById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Create a new purchase order' })
  async create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.createPurchaseOrder(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Update a draft purchase order' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.updatePurchaseOrder(id, dto, user.sub);
  }

  @Post(':id/receive')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Receive goods for a purchase order' })
  async receive(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.receivePurchaseOrder(id, dto, user.sub);
  }
}

// ── Sale Orders ───────────────────────────

@Controller('sale-orders')
@ApiTags('sale-orders')
@ApiBearerAuth('access-token')
export class SaleOrdersController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'List all sale orders' })
  @ApiQuery({ name: 'customerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: SaleOrderStatus })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAll(
    @Query('customerId') customerId?: string,
    @Query('status') status?: SaleOrderStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.getAllSaleOrders({
      customerId,
      status,
      from,
      to,
      page,
      limit,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Get sale order by ID' })
  async getById(@Param('id') id: string) {
    return this.salesService.getSaleOrderById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Create a new sale order' })
  async create(
    @Body() dto: CreateSaleOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.createSaleOrder(dto, user.sub);
  }

  @Patch(':id/confirm')
  @RequirePermissions(PERMISSIONS.SALES_APPROVE)
  @ApiOperation({ summary: 'Confirm a sale order' })
  async confirm(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.confirmSaleOrder(id, user.sub);
  }

  @Patch(':id/dispatch')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Dispatch a sale order' })
  async dispatch(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.dispatchSaleOrder(id, user.sub);
  }

  @Patch(':id/deliver')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Mark a sale order as delivered' })
  async deliver(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.deliverSaleOrder(id, user.sub);
  }

  @Patch(':id/cancel')
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Cancel a sale order' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.cancelSaleOrder(id, user.sub);
  }
}

// ── Challans ──────────────────────────────

@Controller('challans')
@ApiTags('challans')
@ApiBearerAuth('access-token')
export class ChallansController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'List all delivery challans' })
  @ApiQuery({ name: 'saleOrderId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ChallanStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAll(
    @Query('saleOrderId') saleOrderId?: string,
    @Query('status') status?: ChallanStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.getAllChallans({
      saleOrderId,
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Get delivery challan by ID' })
  async getById(@Param('id') id: string) {
    return this.salesService.getChallanById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Create a delivery challan' })
  async create(
    @Body() dto: CreateChallanDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.createChallan(dto, user.sub);
  }

  @Get(':id/pdf')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Get challan data for PDF generation' })
  async getPdf(@Param('id') id: string) {
    return this.salesService.getChallanPdf(id);
  }
}

// ── Payments ──────────────────────────────

@Controller('payments')
@ApiTags('payments')
@ApiBearerAuth('access-token')
export class PaymentsController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_WRITE)
  @ApiOperation({ summary: 'Record a payment' })
  async record(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesService.recordPayment(dto, user.sub);
  }

  @Get('by-order/:saleOrderId')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Get payments by sale order' })
  async getByOrder(@Param('saleOrderId') saleOrderId: string) {
    return this.salesService.getPaymentsByOrder(saleOrderId);
  }

  @Get('outstanding')
  @RequirePermissions(PERMISSIONS.SALES_READ)
  @ApiOperation({ summary: 'Get orders with outstanding payments' })
  async getOutstanding() {
    return this.salesService.getOutstandingPayments();
  }
}
