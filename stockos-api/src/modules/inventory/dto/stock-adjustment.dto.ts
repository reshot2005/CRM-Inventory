import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { AdjustmentReason } from '@prisma/client';

export class StockAdjustmentDto {
  @ApiProperty({ description: 'Item ID' })
  @IsString()
  itemId: string;

  @ApiProperty({ description: 'Location ID' })
  @IsString()
  locationId: string;

  @ApiProperty({
    example: -5,
    description: 'Positive to add stock, negative to remove',
  })
  @IsNumber()
  quantity: number;

  @ApiProperty({ enum: AdjustmentReason })
  @IsEnum(AdjustmentReason)
  reason: AdjustmentReason;

  @ApiPropertyOptional({ example: 'Found 5 damaged units during audit' })
  @IsString()
  @IsOptional()
  notes?: string;
}
