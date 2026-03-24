import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaleOrderLineDto {
  @ApiProperty({ description: 'Item ID' })
  @IsString()
  itemId: string;

  @ApiProperty({ minimum: 0.01, description: 'Quantity' })
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiProperty({ minimum: 0, description: 'Unit price' })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreateSaleOrderDto {
  @ApiProperty({ description: 'Customer ID' })
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Warehouse location ID' })
  @IsString()
  locationId: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SaleOrderLineDto], description: 'Order lines' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleOrderLineDto)
  lines: SaleOrderLineDto[];
}
