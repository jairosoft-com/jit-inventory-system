import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequirePermissions } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UsersService } from './users.service';

type RequestWithUser = Request & {
  user?: {
    id: number;
    email: string;
    roleId: number;
  };
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermissions('users:read')
  @Get('summary')
  getSummary() {
    return this.usersService.getSummary();
  }

  @RequirePermissions('roles:read')
  @Get('roles')
  getRoles() {
    return this.usersService.getRoles();
  }

  @RequirePermissions('users:read')
  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @RequirePermissions('users:read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @RequirePermissions('users:manage')
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @RequirePermissions('users:manage')
  @Patch(':id/access')
  updateAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserAccessDto: UpdateUserAccessDto,
    @Req() request: RequestWithUser,
  ) {
    return this.usersService.updateAccess(
      id,
      updateUserAccessDto,
      request.user?.id,
    );
  }
}
