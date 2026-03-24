import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from '@prisma/client';

export class CustomerContactDto {
  @ApiProperty({ description: 'Contact person name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Role / designation' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ description: 'Phone numbers', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  phones: string[];

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Is this the primary contact?', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer type', enum: CustomerType, default: 'BUSINESS' })
  @IsEnum(CustomerType)
  @IsOptional()
  type?: CustomerType;

  @ApiPropertyOptional({ description: 'Company name (for BUSINESS type)' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({ description: 'Primary contact person name' })
  @IsString()
  @IsNotEmpty()
  primaryContact: string;

  @ApiProperty({ description: 'Phone numbers', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  phones: string[];

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Google Maps Place ID' })
  @IsString()
  @IsOptional()
  gmapsPlaceId?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'GSTIN' })
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'gstin must be a valid 15-character GSTIN',
  })
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({ description: 'PAN number' })
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'pan must be a valid 10-character PAN',
  })
  @IsOptional()
  pan?: string;

  @ApiPropertyOptional({ description: 'Payment terms', default: 'NET_30' })
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Credit limit in INR', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Customer contacts', type: [CustomerContactDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerContactDto)
  @IsOptional()
  contacts?: CustomerContactDto[];
}

export class UpdateCustomerDto {
  @ApiPropertyOptional({ description: 'Customer type', enum: CustomerType })
  @IsEnum(CustomerType)
  @IsOptional()
  type?: CustomerType;

  @ApiPropertyOptional({ description: 'Company name' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Primary contact person name' })
  @IsString()
  @IsOptional()
  primaryContact?: string;

  @ApiPropertyOptional({ description: 'Phone numbers', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  phones?: string[];

  @ApiPropertyOptional({ description: 'Address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Google Maps Place ID' })
  @IsString()
  @IsOptional()
  gmapsPlaceId?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ description: 'GSTIN' })
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'gstin must be a valid 15-character GSTIN',
  })
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({ description: 'PAN number' })
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'pan must be a valid 10-character PAN',
  })
  @IsOptional()
  pan?: string;

  @ApiPropertyOptional({ description: 'Payment terms' })
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @ApiPropertyOptional({ description: 'Credit limit', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
