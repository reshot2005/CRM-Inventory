import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderLineDto {
  @ApiProperty({ description: 'Item ID' })
  @IsString()
  itemId: string;

  @ApiProperty({ minimum: 0.01, description: 'Ordered quantity' })
  @IsNumber()
  @Min(0.01)
  orderedQty: number;

  @ApiProperty({ minimum: 0, description: 'Unit price' })
  @IsNumber()
  @Min(0)
  unitPrice: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Vendor ID' })
  @IsString()
  vendorId: string;

  @ApiPropertyOptional({ description: 'Expected delivery date' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [PurchaseOrderLineDto], description: 'Order lines' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines: PurchaseOrderLineDto[];
}

export class UpdatePurchaseOrderDto extends PartialType(
  CreatePurchaseOrderDto,
) {}

export class ReceiveLineDto {
  @ApiProperty({ description: 'Purchase order line ID' })
  @IsString()
  lineId: string;

  @ApiProperty({ minimum: 0, description: 'Quantity received' })
  @IsNumber()
  @Min(0)
  receivedQty: number;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiProperty({ description: 'Destination location ID' })
  @IsString()
  locationId: string;
}

export class ReceivePurchaseOrderDto {
  @ApiProperty({ type: [ReceiveLineDto], description: 'Lines to receive' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines: ReceiveLineDto[];
}
