import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Matches,
  IsObject,
} from 'class-validator';
import { ItemCategory, PackagingType } from '@prisma/client';

export class CreateItemDto {
  @ApiProperty({ example: 'Kraft Paper Roll 120gsm' })
  @IsString()
  standardizedName: string;

  @ApiProperty({
    example: 'RM-001',
    description: '2-4 uppercase letters, dash, 3-4 digits',
  })
  @Matches(/^[A-Z]{2,4}-\d{3,4}$/, {
    message: 'productCode must match pattern: XX-000 (e.g. RM-001, PACK-1234)',
  })
  productCode: string;

  @ApiPropertyOptional({ example: 'BrandX' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ enum: ItemCategory })
  @IsEnum(ItemCategory)
  category: ItemCategory;

  @ApiPropertyOptional({ enum: PackagingType })
  @IsEnum(PackagingType)
  @IsOptional()
  packagingType?: PackagingType;

  @ApiPropertyOptional({ example: '50kg' })
  @IsString()
  @IsOptional()
  packagingSize?: string;

  @ApiProperty({ example: 100, minimum: 0 })
  @IsNumber()
  @Min(0)
  minStockLevel: number;

  @ApiPropertyOptional({ example: { color: 'brown', gsm: 120 } })
  @IsObject()
  @IsOptional()
  specifications?: Record<string, unknown>;
}
