import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/types';
import { UserRole as PrismaUserRole, UserStatus } from '@prisma/client';
import { JwtPayload } from '../../common/types';
import { ApproveUserDto, RejectUserDto } from './dto/approve-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List all users with filtering and pagination' })
  @ApiQuery({ name: 'status', enum: UserStatus, required: false })
  @ApiQuery({ name: 'role', enum: PrismaUserRole, required: false })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: UserStatus,
    @Query('role') role?: PrismaUserRole,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.findAll({ status, role, search, page, limit });
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List users awaiting approval' })
  findPending() {
    return this.usersService.findPending();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get a user by ID' })
  findById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a pending user and assign a role' })
  approve(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() dto: ApproveUserDto,
  ) {
    return this.usersService.approve(admin.sub, userId, dto.role);
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a pending user with a reason' })
  reject(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() dto: RejectUserDto,
  ) {
    return this.usersService.reject(admin.sub, userId, dto.reason);
  }

  @Post(':id/suspend')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Suspend an active user and revoke sessions' })
  suspend(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    return this.usersService.suspend(admin.sub, userId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user details' })
  update(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(admin.sub, userId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Permanently delete a user' })
  remove(
    @CurrentUser() admin: JwtPayload,
    @Param('id') userId: string,
  ) {
    return this.usersService.delete(admin.sub, userId);
  }
}
