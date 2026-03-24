import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';
import { PaymentMode } from '@prisma/client';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Sale order ID' })
  @IsString()
  saleOrderId: string;

  @ApiProperty({ minimum: 0.01, description: 'Payment amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PaymentMode, description: 'Payment mode' })
  @IsEnum(PaymentMode)
  mode: PaymentMode;

  @ApiPropertyOptional({ description: 'Reference number' })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
