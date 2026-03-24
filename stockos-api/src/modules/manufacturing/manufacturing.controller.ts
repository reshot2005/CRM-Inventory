import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProductionStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PERMISSIONS, UserRole } from '../../common/types/user-role.enum';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { ManufacturingService } from './manufacturing.service';
import { CreateBOMDto, UpdateBOMDto } from './dto/create-bom.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';

// ─── Query DTOs ──────────────────────────────────────────────────────────────

class BOMQueryDto {
  @ApiPropertyOptional({ description: 'Search by finished good name or code' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

class ProductionOrderQueryDto {
  @ApiPropertyOptional({ enum: ProductionStatus })
  @IsEnum(ProductionStatus)
  @IsOptional()
  status?: ProductionStatus;

  @ApiPropertyOptional({ description: 'Search by order number or batch number' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

class CalculateQueryDto {
  @ApiPropertyOptional({ description: 'Target production quantity', default: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  targetQty?: number;
}

class StartProductionDto {
  @ApiPropertyOptional({ description: 'Location ID where production takes place' })
  @IsString()
  @IsOptional()
  locationId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MANUFACTURING CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('manufacturing')
@ApiTags('Manufacturing')
@ApiBearerAuth()
export class ManufacturingController {
  constructor(private readonly mfgService: ManufacturingService) {}

  // ─── BOMs ──────────────────────────────────────────────────────────────────

  @Get('boms')
  @ApiOperation({ summary: 'List all active BOMs with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated BOM list' })
  @RequirePermissions(PERMISSIONS.MFG_READ)
  async getAllBOMs(@Query() query: BOMQueryDto) {
    return this.mfgService.getAllBOMs(query);
  }

  @Get('boms/:id')
  @ApiOperation({ summary: 'Get BOM details with lines' })
  @ApiParam({ name: 'id', description: 'BOM ID' })
  @ApiResponse({ status: 200, description: 'BOM details' })
  @ApiResponse({ status: 404, description: 'BOM not found' })
  @RequirePermissions(PERMISSIONS.MFG_READ)
  async getBOMById(@Param('id') id: string) {
    return this.mfgService.getBOMById(id);
  }

  @Get('boms/:id/calculate')
  @ApiOperation({ summary: 'Calculate raw material requirements for a BOM' })
  @ApiParam({ name: 'id', description: 'BOM ID' })
  @ApiResponse({ status: 200, description: 'Material requirements breakdown' })
  @ApiResponse({ status: 404, description: 'BOM not found' })
  @RequirePermissions(PERMISSIONS.MFG_READ)
  async calculateBOMRequirements(
    @Param('id') id: string,
    @Query() query: CalculateQueryDto,
  ) {
    return this.mfgService.calculateBOMRequirements(id, query.targetQty ?? 1);
  }

  @Post('boms')
  @ApiOperation({ summary: 'Create a new Bill of Materials' })
  @ApiResponse({ status: 201, description: 'BOM created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @RequirePermissions(PERMISSIONS.MFG_WRITE)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async createBOM(
    @Body() dto: CreateBOMDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mfgService.createBOM(dto, user.sub);
  }

  @Patch('boms/:id')
  @ApiOperation({ summary: 'Update an existing BOM' })
  @ApiParam({ name: 'id', description: 'BOM ID' })
  @ApiResponse({ status: 200, description: 'BOM updated' })
  @ApiResponse({ status: 404, description: 'BOM not found' })
  @RequirePermissions(PERMISSIONS.MFG_WRITE)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async updateBOM(
    @Param('id') id: string,
    @Body() dto: UpdateBOMDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mfgService.updateBOM(id, dto, user.sub);
  }

  @Delete('boms/:id')
  @ApiOperation({ summary: 'Soft-delete a BOM' })
  @ApiParam({ name: 'id', description: 'BOM ID' })
  @ApiResponse({ status: 200, description: 'BOM deactivated' })
  @ApiResponse({ status: 400, description: 'BOM has active production orders' })
  @ApiResponse({ status: 404, description: 'BOM not found' })
  @Roles(UserRole.ADMIN)
  async deleteBOM(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.mfgService.deleteBOM(id, user.sub);
    return { message: 'BOM deactivated' };
  }

  // ─── Production Orders ─────────────────────────────────────────────────────

  @Get('production-orders')
  @ApiOperation({ summary: 'List production orders with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated production order list' })
  @RequirePermissions(PERMISSIONS.MFG_READ)
  async getAllProductionOrders(@Query() query: ProductionOrderQueryDto) {
    return this.mfgService.getAllProductionOrders(query);
  }

  @Get('production-orders/summary')
  @ApiOperation({ summary: 'Get production order summary (counts by status)' })
  @ApiResponse({ status: 200, description: 'Production summary' })
  @RequirePermissions(PERMISSIONS.MFG_READ)
  async getProductionSummary() {
    return this.mfgService.getProductionSummary();
  }

  @Get('production-orders/:id')
  @ApiOperation({ summary: 'Get production order details' })
  @ApiParam({ name: 'id', description: 'Production order ID' })
  @ApiResponse({ status: 200, description: 'Production order details' })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @RequirePermissions(PERMISSIONS.MFG_READ)
  async getProductionOrderById(@Param('id') id: string) {
    return this.mfgService.getProductionOrderById(id);
  }

  @Post('production-orders')
  @ApiOperation({ summary: 'Create a new production order' })
  @ApiResponse({ status: 201, description: 'Production order created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'BOM or location not found' })
  @RequirePermissions(PERMISSIONS.MFG_WRITE)
  async createProductionOrder(
    @Body() dto: CreateProductionOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mfgService.createProductionOrder(dto, user.sub);
  }

  @Patch('production-orders/:id/start')
  @ApiOperation({ summary: 'Start production (reserves raw materials)' })
  @ApiParam({ name: 'id', description: 'Production order ID' })
  @ApiResponse({ status: 200, description: 'Production started' })
  @ApiResponse({ status: 400, description: 'Invalid status or insufficient stock' })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @RequirePermissions(PERMISSIONS.MFG_WRITE)
  async startProduction(
    @Param('id') id: string,
    @Body() dto: StartProductionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mfgService.startProduction(id, user.sub, dto.locationId ?? '');
  }

  @Patch('production-orders/:id/complete')
  @ApiOperation({ summary: 'Complete production (deducts materials, adds finished goods)' })
  @ApiParam({ name: 'id', description: 'Production order ID' })
  @ApiResponse({ status: 200, description: 'Production completed' })
  @ApiResponse({ status: 400, description: 'Invalid status or material mismatch' })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @RequirePermissions(PERMISSIONS.MFG_WRITE)
  async completeProduction(
    @Param('id') id: string,
    @Body() dto: CompleteProductionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mfgService.completeProduction(id, dto, user.sub);
  }

  @Patch('production-orders/:id/cancel')
  @ApiOperation({ summary: 'Cancel production order (releases reservations)' })
  @ApiParam({ name: 'id', description: 'Production order ID' })
  @ApiResponse({ status: 200, description: 'Production cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel in current status' })
  @ApiResponse({ status: 404, description: 'Production order not found' })
  @RequirePermissions(PERMISSIONS.MFG_APPROVE)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async cancelProduction(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.mfgService.cancelProduction(id, user.sub);
  }
}
