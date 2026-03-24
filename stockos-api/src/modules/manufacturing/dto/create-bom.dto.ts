import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BOMLineDto {
  @ApiProperty({ description: 'Raw material item ID' })
  @IsString()
  @IsNotEmpty()
  rawMaterialId: string;

  @ApiProperty({ description: 'Quantity required', minimum: 0.001 })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ description: 'Unit of measurement (e.g. kg, pcs, litre)' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiPropertyOptional({ description: 'Expected waste percentage', minimum: 0, maximum: 100, default: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  wastePercent?: number;
}

export class CreateBOMDto {
  @ApiProperty({ description: 'Finished good item ID' })
  @IsString()
  @IsNotEmpty()
  finishedGoodId: string;

  @ApiPropertyOptional({ description: 'BOM version', default: '1.0' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ description: 'Yield quantity per batch', minimum: 0.01, default: 1 })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  yieldQty?: number;

  @ApiPropertyOptional({ description: 'Yield unit', default: 'unit' })
  @IsString()
  @IsOptional()
  yieldUnit?: string;

  @ApiPropertyOptional({ description: 'Notes or instructions' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'BOM lines (raw materials)', type: [BOMLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BOMLineDto)
  lines: BOMLineDto[];
}

export class UpdateBOMDto {
  @ApiPropertyOptional({ description: 'BOM version' })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({ description: 'Yield quantity per batch', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  @IsOptional()
  yieldQty?: number;

  @ApiPropertyOptional({ description: 'Yield unit' })
  @IsString()
  @IsOptional()
  yieldUnit?: string;

  @ApiPropertyOptional({ description: 'Notes or instructions' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Replace all BOM lines', type: [BOMLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BOMLineDto)
  @IsOptional()
  lines?: BOMLineDto[];
}
