import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import {
  CreateUserInput,
  QueryUsersInput,
  UpdateUserAccessInput,
} from '../schemas/users.schema.js';

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
} as const;

type DbUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export class UsersService {
  private static mapUser(user: DbUser) {
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
      permissions: user.role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    };
  }

  static async create(data: CreateUserInput) {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new Error('Email is already in use');
    }

    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    // DevPlan §5.3 requires bcrypt cost factor of 12
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        isActive: data.isActive ?? true,
        roleId: data.roleId,
      },
      select: userSelect,
    });

    return this.mapUser(user);
  }

  static async getSummary() {
    const [totalUsers, activeUsers, inactiveUsers, administratorUsers] =
      await Promise.all([
        prisma.user.count({
          where: { deletedAt: null },
        }),
        prisma.user.count({
          where: { deletedAt: null, isActive: true },
        }),
        prisma.user.count({
          where: { deletedAt: null, isActive: false },
        }),
        prisma.user.count({
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

  static async getRoles() {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
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
              where: { deletedAt: null },
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
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        resource: rp.permission.resource,
        action: rp.permission.action,
        description: rp.permission.description,
      })),
    }));
  }

  static async findAll(query: QueryUsersInput) {
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
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
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

  static async findOne(id: number) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: userSelect,
    });

    if (!user) {
      throw new Error('User not found');
    }

    return this.mapUser(user);
  }

  static async findOneByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        deletedAt: null,
      },
    });
  }

  static async updateAccess(
    id: number,
    data: UpdateUserAccessInput,
    currentUserId?: number,
  ) {
    const hasRoleUpdate = data.roleId !== undefined;
    const hasStatusUpdate = data.isActive !== undefined;

    if (!hasRoleUpdate && !hasStatusUpdate) {
      throw new Error(
        'Provide at least one field to update: roleId or isActive',
      );
    }

    await this.findOne(id);

    if (currentUserId === id && data.isActive === false) {
      throw new Error('You cannot deactivate your own account');
    }

    if (currentUserId === id && hasRoleUpdate) {
      throw new Error('You cannot change your own role');
    }

    const updateData: Prisma.UserUncheckedUpdateInput = {};

    if (hasStatusUpdate) {
      updateData.isActive = data.isActive;
    }

    if (hasRoleUpdate) {
      const role = await prisma.role.findUnique({
        where: { id: data.roleId },
      });

      if (!role) {
        throw new Error('Role not found');
      }

      updateData.roleId = data.roleId;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    return this.mapUser(updatedUser);
  }
}
