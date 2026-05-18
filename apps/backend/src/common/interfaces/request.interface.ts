import { Request } from 'express';

export interface AuthenticatedUser {
  id: number;
  roleId: number;
  email?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
