import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VendorContactDto {
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

export class CreateVendorDto {
  @ApiProperty({ description: 'Company / vendor name' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiPropertyOptional({
    description: 'GST Identification Number (15-char alphanumeric)',
    example: '22AAAAA0000A1Z5',
  })
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'gstin must be a valid 15-character GSTIN',
  })
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({
    description: 'PAN number',
    example: 'AAAAA0000A',
  })
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

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Vendor contacts', type: [VendorContactDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VendorContactDto)
  @IsOptional()
  contacts?: VendorContactDto[];
}

export class UpdateVendorDto {
  @ApiPropertyOptional({ description: 'Company / vendor name' })
  @IsString()
  @IsOptional()
  companyName?: string;

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

  @ApiPropertyOptional({ description: 'Credit limit in INR', minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({ description: 'Additional remarks' })
  @IsString()
  @IsOptional()
  remarks?: string;

  @ApiPropertyOptional({ description: 'Active status' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
