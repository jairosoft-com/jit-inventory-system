import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    roleId: 1,
    role: { id: 1, name: 'ADMIN', description: 'Admin' },
    isActive: true,
    createdAt: new Date(),
    deletedAt: null,
  };

  const mockAuthService = {
    validateUser: jest.fn().mockResolvedValue(mockUser),
    login: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: mockUser,
    }),
    refresh: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: mockUser,
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  const mockUsersService = {
    findOneByEmail: jest.fn().mockResolvedValue(mockUser),
  };

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  const mockRequest = {
    cookies: { jit_refresh_token: 'mock-refresh-token' },
    user: { email: 'test@example.com', sub: 1, roleId: 1 },
  } as unknown as Request;

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) => {
      const config: Record<string, string> = {
        JWT_REFRESH_EXPIRY: '7d',
      };
      return config[key] ?? fallback;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/login', () => {
    it('should validate credentials and return access token and user', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await controller.login(loginDto, mockResponse);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('user');
    });

    it('should set httpOnly refresh token cookie with environment-based secure flag', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      await controller.login(loginDto, mockResponse);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.cookie as jest.Mock).toHaveBeenCalledWith(
        'jit_refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        }),
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.validateUser.mockRejectedValueOnce(
        new UnauthorizedException(),
      );

      await expect(controller.login(loginDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when email is non-existent', async () => {
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockAuthService.validateUser.mockRejectedValueOnce(
        new UnauthorizedException(),
      );

      await expect(controller.login(loginDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('should exchange a valid refresh token cookie for new tokens', async () => {
      const result = await controller.refresh(mockRequest, mockResponse);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        'mock-refresh-token',
      );
      expect(result).toHaveProperty('accessToken', 'new-access-token');
    });

    it('should throw UnauthorizedException when refresh token is missing', async () => {
      const requestWithoutCookie = {
        cookies: {},
      } as unknown as Request;

      await expect(
        controller.refresh(requestWithoutCookie, mockResponse),
      ).rejects.toThrow(new UnauthorizedException('No refresh token provided'));
    });

    it('should throw UnauthorizedException when refresh token is expired or invalid', async () => {
      mockAuthService.refresh.mockRejectedValueOnce(
        new UnauthorizedException(),
      );

      await expect(
        controller.refresh(mockRequest, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke the refresh token and clear the cookie', async () => {
      const result = await controller.logout(mockRequest, mockResponse);

      expect(mockAuthService.logout).toHaveBeenCalledWith('mock-refresh-token');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.clearCookie as jest.Mock).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });

    it('should clear the cookie even if no refresh token is present', async () => {
      const requestWithoutCookie = {
        cookies: {},
      } as unknown as Request;

      const result = await controller.logout(
        requestWithoutCookie,
        mockResponse,
      );

      expect(mockAuthService.logout).not.toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockResponse.clearCookie as jest.Mock).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });
  });
});
