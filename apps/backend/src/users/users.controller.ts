import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: GET /users, GET /users/:id, POST /users, PATCH /users/:id, DELETE /users/:id
}
