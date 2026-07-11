import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import logger from '../../logger';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

const PUBLIC_ROUTES = [
  { path: '/auth/register', method: 'POST' },
  { path: '/auth/login', method: 'POST' },
  { path: '/health', method: 'GET' },
  { path: '/metrics', method: 'GET' },
  { path: '/payments/webhook', method: 'POST' },
];

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const isPublic = PUBLIC_ROUTES.some(
      (route) => route.path === req.path && route.method === req.method,
    );

    if (isPublic) {
      return next();
    }

    const authorization = req.headers['authorization'];
    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authorization.replace('Bearer ', '').trim();
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    try {
      const payload = this.jwtService.verify(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      next();
    } catch (error) {
      logger.warn('Invalid or expired token', {
        error: (error as Error).message,
        path: req.path,
      });

      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}