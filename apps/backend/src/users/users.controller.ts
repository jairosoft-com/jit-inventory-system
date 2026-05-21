import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('summary')
  getSummary() {
    return this.usersService.getSummary();
  }

  @Get('roles')
  getRoles() {
    return this.usersService.getRoles();
  }

  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/access')
  updateAccess(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserAccessDto: UpdateUserAccessDto,
  ) {
    return this.usersService.updateAccess(id, updateUserAccessDto);
  }
}