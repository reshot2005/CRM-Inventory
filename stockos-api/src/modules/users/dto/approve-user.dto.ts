import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ApproveUserDto {
  @ApiProperty({ enum: UserRole, description: 'Role to assign upon approval' })
  @IsEnum(UserRole)
  role: UserRole;
}

export class RejectUserDto {
  @ApiProperty({
    example: 'Insufficient documentation provided',
    minLength: 5,
  })
  @IsString()
  @MinLength(5)
  reason: string;
}
