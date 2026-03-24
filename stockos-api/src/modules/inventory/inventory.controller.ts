import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { Readable } from 'stream';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/types';
import { JwtPayload } from '../../common/types';
import { ItemCategory } from '@prisma/client';

import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import {
  CreateMoveOrderDto,
  CompleteMoveOrderDto,
} from './dto/create-move-order.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { CreateLocationDto } from './dto/create-location.dto';

// ─── ITEMS ────────────────────────────────────────────────────

@ApiTags('items')
@ApiBearerAuth('access-token')
@Controller('inventory/items')
export class ItemsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'List items with filters and pagination' })
  @ApiQuery({ name: 'category', enum: ItemCategory, required: false })
  @ApiQuery({ name: 'brand', required: false, type: String })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAllItems(
    @Query('category') category?: ItemCategory,
    @Query('brand') brand?: string,
    @Query('lowStock') lowStock?: boolean,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getAllItems({
      category,
      brand,
      lowStock,
      search,
      page,
      limit,
    });
  }

  @Get('low-stock')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get items where total stock is at or below minimum' })
  getLowStockItems() {
    return this.inventoryService.getLowStockItems();
  }

  @Get(':id')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get item details with inventory and recent ledger' })
  getItemById(@Param('id') id: string) {
    return this.inventoryService.getItemById(id);
  }

  @Get(':id/stock')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get stock levels per location for an item' })
  getStockByItem(@Param('id') itemId: string) {
    return this.inventoryService.getStockByItem(itemId);
  }

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new item' })
  createItem(
    @Body() dto: CreateItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.createItem(dto, user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Update an item' })
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.updateItem(id, dto, user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Soft-delete (deactivate) an item' })
  deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.deleteItem(id, user.sub);
  }
}

// ─── MOVE ORDERS ──────────────────────────────────────────────

@ApiTags('move-orders')
@ApiBearerAuth('access-token')
@Controller('inventory/move-orders')
export class MoveOrdersController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Create a new move order (DRAFT)' })
  createMoveOrder(
    @Body() dto: CreateMoveOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.createMoveOrder(dto, user.sub);
  }

  @Post(':id/submit')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Submit a DRAFT order for approval (PENDING)' })
  submitMoveOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.submitMoveOrder(id, user.sub);
  }

  @Post(':id/approve')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a PENDING order and reserve stock' })
  approveMoveOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.approveMoveOrder(id, user.sub);
  }

  @Post(':id/dispatch')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Dispatch an APPROVED order and deduct stock' })
  dispatchMoveOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.dispatchMoveOrder(id, user.sub);
  }

  @Post(':id/complete')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Complete an IN_TRANSIT order and receive stock' })
  completeMoveOrder(
    @Param('id') id: string,
    @Body() dto: CompleteMoveOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.completeMoveOrder(id, dto, user.sub);
  }

  @Post(':id/cancel')
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Cancel an order (releases reservations if APPROVED)' })
  cancelMoveOrder(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.cancelMoveOrder(id, user.sub);
  }
}

// ─── STOCK LEDGER & ADJUSTMENTS ───────────────────────────────

@ApiTags('stock')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class StockController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('ledger/export')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Download stock ledger as streamed CSV' })
  exportLedger(@Query() query: LedgerQueryDto): StreamableFile {
    const stream = Readable.from(
      this.inventoryService.streamLedgerCsv(query),
    );
    return new StreamableFile(stream, {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="stock-ledger.csv"',
    });
  }

  @Get('ledger')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Query the stock ledger with filters' })
  getStockLedger(@Query() query: LedgerQueryDto) {
    return this.inventoryService.getStockLedger(query);
  }

  @Post('adjustments')
  @Roles(UserRole.STAFF)
  @ApiOperation({
    summary: 'Create a stock adjustment (auto-approved for MANAGER/ADMIN)',
  })
  createAdjustment(
    @Body() dto: StockAdjustmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.createAdjustment(
      dto,
      user.sub,
      user.role,
    );
  }

  @Post('adjustments/:id/approve')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve a pending stock adjustment' })
  approveAdjustment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.approveAdjustment(id, user.sub);
  }

  @Post('adjustments/:id/reject')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Reject a pending stock adjustment' })
  rejectAdjustment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.rejectAdjustment(id, user.sub);
  }
}

// ─── LOCATIONS ────────────────────────────────────────────────

@ApiTags('locations')
@ApiBearerAuth('access-token')
@Controller('inventory/locations')
export class LocationsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'List all locations' })
  getLocations() {
    return this.inventoryService.getLocations();
  }

  @Post()
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Create a new location' })
  createLocation(
    @Body() dto: CreateLocationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventoryService.createLocation(dto, user.sub);
  }
}
