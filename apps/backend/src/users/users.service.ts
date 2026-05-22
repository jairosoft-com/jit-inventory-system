import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  roleId: true,
  isActive: true,
  createdAt: true,
  deletedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
      rolePermissions: {
        select: {
          permission: {
            select: {
              id: true,
              name: true,
              resource: true,
              action: true,
              description: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

type UserWithAccess = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const normalizedEmail = createUserDto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      throw new BadRequestException('Email is already in use');
    }

    const role = await this.prisma.role.findUnique({
      where: {
        id: createUserDto.roleId,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: createUserDto.firstName.trim(),
          lastName: createUserDto.lastName.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          isActive: createUserDto.isActive ?? true,
          role: {
            connect: {
              id: createUserDto.roleId,
            },
          },
        },
        select: userSelect,
      });

      return this.mapUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Email is already in use');
      }

      throw error;
    }
  }

  async getSummary() {
    const [totalUsers, activeUsers, inactiveUsers, administratorUsers] =
      await Promise.all([
        this.prisma.user.count({
          where: {
            deletedAt: null,
          },
        }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            isActive: true,
          },
        }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            isActive: false,
          },
        }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            role: {
              name: {
                equals: 'ADMIN',
                mode: 'insensitive',
              },
            },
          },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      administratorUsers,
    };
  }

  async getRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        rolePermissions: {
          select: {
            permission: {
              select: {
                id: true,
                name: true,
                resource: true,
                action: true,
                description: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: {
              where: {
                deletedAt: null,
              },
            },
            rolePermissions: true,
          },
        },
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissionCount: role._count.rolePermissions,
      permissions: role.rolePermissions.map((rolePermission) => ({
        id: rolePermission.permission.id,
        name: rolePermission.permission.name,
        resource: rolePermission.permission.resource,
        action: rolePermission.permission.action,
        description: rolePermission.permission.description,
      })),
    }));
  }

  async findAll(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (query.roleId !== undefined) {
      where.roleId = query.roleId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [
          {
            firstName: 'asc',
          },
          {
            lastName: 'asc',
          },
        ],
        skip,
        take: limit,
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      data: users.map((user) => this.mapUser(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapUser(user);
  }

  async updateAccess(
    id: number,
    updateUserAccessDto: UpdateUserAccessDto,
    currentUserId?: number,
  ) {
    const hasRoleUpdate = updateUserAccessDto.roleId !== undefined;
    const hasStatusUpdate = updateUserAccessDto.isActive !== undefined;

    if (!hasRoleUpdate && !hasStatusUpdate) {
      throw new BadRequestException(
        'Provide at least one field to update: roleId or isActive',
      );
    }

    await this.findOne(id);

    if (currentUserId === id && updateUserAccessDto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    if (currentUserId === id && hasRoleUpdate) {
      throw new BadRequestException('You cannot change your own role');
    }

    const data: Prisma.UserUpdateInput = {};

    if (hasStatusUpdate) {
      data.isActive = updateUserAccessDto.isActive;
    }

    if (hasRoleUpdate) {
      const role = await this.prisma.role.findUnique({
        where: {
          id: updateUserAccessDto.roleId,
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      data.role = {
        connect: {
          id: updateUserAccessDto.roleId,
        },
      };
    }

    const updatedUser = await this.prisma.user.update({
      where: {
        id,
      },
      data,
      select: userSelect,
    });

    return this.mapUser(updatedUser);
  }

  private mapUser(user: UserWithAccess) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description,
      },
      status: user.isActive ? 'Active' : 'Inactive',
      isActive: user.isActive,
      createdAt: user.createdAt,
      permissions: user.role.rolePermissions.map((rolePermission) => ({
        id: rolePermission.permission.id,
        name: rolePermission.permission.name,
        resource: rolePermission.permission.resource,
        action: rolePermission.permission.action,
        description: rolePermission.permission.description,
      })),
    };
  }
}