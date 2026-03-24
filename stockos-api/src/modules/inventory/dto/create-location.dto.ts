import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, IsOptional } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Main Warehouse' })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'WH-01',
    description: '2-4 uppercase letters, dash, 2-4 alphanumeric chars',
  })
  @Matches(/^[A-Z]{2,4}-[A-Z0-9]{2,4}$/, {
    message: 'code must match pattern: XX-XX (e.g. WH-01, PROD-A1)',
  })
  code: string;

  @ApiProperty({ example: 'WAREHOUSE', description: 'Location type' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: '123 Industrial Area, City' })
  @IsString()
  @IsOptional()
  address?: string;
}
