import { Test, TestingModule } from '@nestjs/testing';
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
  };

  const mockRequest = {
    cookies: { jit_refresh_token: 'mock-refresh-token' },
    user: { email: 'test@example.com', sub: 1, roleId: 1 },
  };

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

      const result = await controller.login(loginDto, mockResponse as never);

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

      await controller.login(loginDto, mockResponse as never);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'jit_refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        }),
      );
    });
  });

  describe('POST /auth/refresh', () => {
    it('should exchange a valid refresh token cookie for new tokens', async () => {
      const result = await controller.refresh(
        mockRequest as never,
        mockResponse as never,
      );

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        'mock-refresh-token',
      );
      expect(result).toHaveProperty('accessToken', 'new-access-token');
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke the refresh token and clear the cookie', async () => {
      const result = await controller.logout(
        mockRequest as never,
        mockResponse as never,
      );

      expect(mockAuthService.logout).toHaveBeenCalledWith('mock-refresh-token');
      expect(mockResponse.clearCookie).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });
  });
});
