import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateChallanDto {
  @ApiProperty({ description: 'Sale order ID' })
  @IsString()
  saleOrderId: string;

  @ApiProperty({ description: 'From address' })
  @IsString()
  fromAddress: string;

  @ApiProperty({ description: 'To address' })
  @IsString()
  toAddress: string;

  @ApiPropertyOptional({ description: 'Vehicle number' })
  @IsOptional()
  @IsString()
  vehicleNo?: string;
}
