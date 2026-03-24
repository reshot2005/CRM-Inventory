import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MoveOrderType } from '@prisma/client';

export class MoveOrderLineDto {
  @ApiProperty({ description: 'ID of the item' })
  @IsString()
  itemId: string;

  @ApiProperty({ example: 10, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  requestedQty: number;
}

export class CreateMoveOrderDto {
  @ApiProperty({ enum: MoveOrderType })
  @IsEnum(MoveOrderType)
  type: MoveOrderType;

  @ApiPropertyOptional({ description: 'Source location ID' })
  @IsString()
  @IsOptional()
  fromLocationId?: string;

  @ApiPropertyOptional({ description: 'Destination location ID' })
  @IsString()
  @IsOptional()
  toLocationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [MoveOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MoveOrderLineDto)
  lines: MoveOrderLineDto[];
}

export class ReceivedLineDto {
  @ApiProperty({ description: 'Move order line ID' })
  @IsString()
  lineId: string;

  @ApiProperty({ example: 10, minimum: 0 })
  @IsNumber()
  @Min(0)
  receivedQty: number;
}

export class CompleteMoveOrderDto {
  @ApiProperty({ type: [ReceivedLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivedLineDto)
  receivedLines: ReceivedLineDto[];
}
