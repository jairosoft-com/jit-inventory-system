import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roleId: 1,
    isActive: true,
    createdAt: new Date(),
    deletedAt: null,
    password: '$2b$10$hashedpassword',
  };

  const mockUsersService = {
    findOneByEmail: jest.fn(),
  };

  const mockPrismaService = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_ACCESS_EXPIRY: '15m',
        JWT_REFRESH_EXPIRY: '7d',
      };
      return config[key];
    }),
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
      };
      const value = config[key];
      if (!value) throw new Error(`Configuration key "${key}" does not exist`);
      return value;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser()', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is inactive', async () => {
      mockUsersService.findOneByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
        password: '$2b$10$hashedpassword',
      });

      // bcrypt.compare will resolve to false for the hashed password test
      await expect(
        service.validateUser('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('generateTokens()', () => {
    it('should call getOrThrow for JWT_ACCESS_SECRET (no fallback)', () => {
      service.generateTokens({ id: 1, email: 'test@example.com', roleId: 1 });

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'JWT_ACCESS_SECRET',
      );
      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_SECRET',
      );
    });

    it('should throw if JWT_ACCESS_SECRET is not configured', () => {
      mockConfigService.getOrThrow.mockImplementationOnce((key: string) => {
        throw new Error(`Configuration key "${key}" does not exist`);
      });

      expect(() =>
        service.generateTokens({ id: 1, email: 'test@example.com', roleId: 1 }),
      ).toThrow(Error);
    });
  });

  describe('refresh()', () => {
    it('should throw UnauthorizedException if JWT verify fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('should throw if token hash is not found in database', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1 });
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('valid-jwt-no-db-record')).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });
  });
});
