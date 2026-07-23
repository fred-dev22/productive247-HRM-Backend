import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { computeEffectivePermissions } from '../permissions/effective-permissions';

// Re-reads permissions from the database on EVERY authenticated request
// (never from the JWT), so a revoked permission or a deactivated account
// takes effect immediately, without waiting for the user to log back in.
// Runs after JwtAuthGuard (see AuthModule providers order), which already
// populates request.user for non-@Public() routes.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authentification requise');
    }

    const user = await this.prisma.user.findUnique({
      where: { Id: userId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });

    if (!user || !user.IsActive) {
      throw new UnauthorizedException('Ce compte a été désactivé');
    }

    const effective = computeEffectivePermissions(
      user.role.rolePermissions.map((rp) => rp.permission.Code),
      user.userPermissions.map((up) => ({ Code: up.permission.Code, IsGranted: up.IsGranted })),
    );

    // Stashed for handlers that need finer-grained (ownership-aware) checks
    // than a single fixed permission code — see @CurrentPermissions().
    request.effectivePermissions = effective;

    const requiredPermission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPermission && !effective.has(requiredPermission)) {
      throw new ForbiddenException(
        `Vous n'avez pas la permission requise (${requiredPermission}) pour effectuer cette action`,
      );
    }

    return true;
  }
}
