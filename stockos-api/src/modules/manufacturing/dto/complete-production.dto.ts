import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConsumedMaterialDto {
  @ApiProperty({ description: 'Raw material item ID' })
  @IsString()
  @IsNotEmpty()
  rawMaterialId: string;

  @ApiProperty({ description: 'Actual quantity consumed', minimum: 0 })
  @IsNumber()
  @Min(0)
  consumedQty: number;
}

export class CompleteProductionDto {
  @ApiProperty({ description: 'Actual quantity produced', minimum: 0 })
  @IsNumber()
  @Min(0)
  actualQty: number;

  @ApiProperty({ description: 'Location where production occurred' })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ description: 'Materials consumed during production', type: [ConsumedMaterialDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsumedMaterialDto)
  consumedMaterials: ConsumedMaterialDto[];
}
