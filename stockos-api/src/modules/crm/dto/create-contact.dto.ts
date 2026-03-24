import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'Contact person name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Role / designation' })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ description: 'Phone numbers', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  phones: string[];

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Is this the primary contact?', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}
