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
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PERMISSIONS, UserRole } from '../../common/types/user-role.enum';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { CrmService } from './crm.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/create-vendor.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { CreateActivityDto } from './dto/customer-activity.dto';

// ─── Query DTOs ──────────────────────────────────────────────────────────────

class VendorQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, vendorId, or GSTIN' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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

class CustomerQueryDto {
  @ApiPropertyOptional({ description: 'Search by name, customerId, company, or GSTIN' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by customer type (INDIVIDUAL / BUSINESS)' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

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

class PaginationQueryDto {
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

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDORS CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('vendors')
@ApiTags('CRM — Vendors')
@ApiBearerAuth()
export class VendorsController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  @ApiOperation({ summary: 'List vendors with optional search and filters' })
  @ApiResponse({ status: 200, description: 'Paginated vendor list' })
  @RequirePermissions(PERMISSIONS.CRM_READ)
  async getAllVendors(@Query() query: VendorQueryDto) {
    return this.crmService.getAllVendors(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor details with contacts and recent POs' })
  @ApiParam({ name: 'id', description: 'Vendor ID (cuid)' })
  @ApiResponse({ status: 200, description: 'Vendor details' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @RequirePermissions(PERMISSIONS.CRM_READ)
  async getVendorById(@Param('id') id: string) {
    return this.crmService.getVendorById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new vendor' })
  @ApiResponse({ status: 201, description: 'Vendor created with auto-generated vendorId' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async createVendor(
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.createVendor(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vendor details' })
  @ApiParam({ name: 'id', description: 'Vendor ID (cuid)' })
  @ApiResponse({ status: 200, description: 'Vendor updated' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async updateVendor(
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.updateVendor(id, dto, user.sub);
  }

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Add a contact to a vendor' })
  @ApiParam({ name: 'id', description: 'Vendor ID (cuid)' })
  @ApiResponse({ status: 201, description: 'Contact added' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async addVendorContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.addVendorContact(id, dto, user.sub);
  }

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Delete a vendor contact' })
  @ApiParam({ name: 'id', description: 'Vendor ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact deleted' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async deleteVendorContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.deleteVendorContact(id, contactId, user.sub);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CUSTOMERS CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

@Controller('customers')
@ApiTags('CRM — Customers')
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly crmService: CrmService) {}

  @Get()
  @ApiOperation({ summary: 'List customers with optional search and filters' })
  @ApiResponse({ status: 200, description: 'Paginated customer list' })
  @RequirePermissions(PERMISSIONS.CRM_READ)
  async getAllCustomers(@Query() query: CustomerQueryDto) {
    return this.crmService.getAllCustomers(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer details with contacts, activities, and orders' })
  @ApiParam({ name: 'id', description: 'Customer ID (cuid)' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @RequirePermissions(PERMISSIONS.CRM_READ)
  async getCustomerById(@Param('id') id: string) {
    return this.crmService.getCustomerById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({ status: 201, description: 'Customer created with auto-generated customerId' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.createCustomer(dto, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update customer details' })
  @ApiParam({ name: 'id', description: 'Customer ID (cuid)' })
  @ApiResponse({ status: 200, description: 'Customer updated' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async updateCustomer(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.updateCustomer(id, dto, user.sub);
  }

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Add a contact to a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID (cuid)' })
  @ApiResponse({ status: 201, description: 'Contact added' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async addCustomerContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.addCustomerContact(id, dto, user.sub);
  }

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Delete a customer contact' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiParam({ name: 'contactId', description: 'Contact ID' })
  @ApiResponse({ status: 200, description: 'Contact deleted' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async deleteCustomerContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.deleteCustomerContact(id, contactId, user.sub);
  }

  @Get(':id/activities')
  @ApiOperation({ summary: 'Get customer activity log' })
  @ApiParam({ name: 'id', description: 'Customer ID (cuid)' })
  @ApiResponse({ status: 200, description: 'Paginated activity list' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @RequirePermissions(PERMISSIONS.CRM_READ)
  async getCustomerActivities(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.crmService.getCustomerActivities(id, query);
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Add an activity entry for a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID (cuid)' })
  @ApiResponse({ status: 201, description: 'Activity created' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  @RequirePermissions(PERMISSIONS.CRM_WRITE)
  async addCustomerActivity(
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crmService.addCustomerActivity(id, dto, user.sub);
  }
}
