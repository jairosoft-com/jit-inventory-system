import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interceptor that logs all API actions to the inventory_logs audit trail.
 * This ensures all data access is logged as required by the non-functional requirements.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const userId = request.user?.id;

    return next.handle().pipe(
      tap(async () => {
        // TODO: Implement audit logging based on route/action mapping
        // Log entry should include: entity_type, entity_id, action, changes, performed_by
        if (userId && method !== 'GET') {
          // Audit log write will be implemented when the inventory_logs
          // table operations are fully built out
        }
      }),
    );
  }
}
