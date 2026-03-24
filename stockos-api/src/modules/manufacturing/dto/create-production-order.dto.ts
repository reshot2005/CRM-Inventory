import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductionOrderDto {
  @ApiProperty({ description: 'BOM ID to produce from' })
  @IsString()
  @IsNotEmpty()
  bomId: string;

  @ApiProperty({ description: 'Target production quantity', minimum: 1 })
  @IsNumber()
  @Min(1)
  targetQty: number;

  @ApiPropertyOptional({ description: 'Production deadline' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ description: 'Batch number for traceability' })
  @IsString()
  @IsOptional()
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Production notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Location where production takes place' })
  @IsString()
  @IsNotEmpty()
  locationId: string;
}
