import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  twoFactorEnabled: boolean;

  @ApiProperty({ type: [String] })
  allowedLocations: string[];

  @ApiPropertyOptional({ type: String, nullable: true })
  rejectionReason: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  lastLoginAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: String, nullable: true })
  approvedBy: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  approvedAt: Date | null;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.name = user.name;
    dto.role = user.role;
    dto.status = user.status;
    dto.twoFactorEnabled = user.twoFactorEnabled;
    dto.allowedLocations = user.allowedLocations;
    dto.rejectionReason = user.rejectionReason;
    dto.lastLoginAt = user.lastLoginAt;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.approvedBy = user.approvedBy;
    dto.approvedAt = user.approvedAt;
    return dto;
  }
}
