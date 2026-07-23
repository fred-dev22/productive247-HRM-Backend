import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { Email: dto.email },
      include: { employee: true, role: true },
    });

    if (!user || !user.IsActive) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.PasswordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (!user.employee) {
      throw new UnauthorizedException('Ce compte n\'est lié à aucun employé');
    }

    await this.prisma.user.update({
      where: { Id: user.Id },
      data: { LastLoginAt: new Date() },
    });

    // Les permissions ne sont jamais mises dans le token : le PermissionGuard
    // les relit en base a chaque requete pour qu'un retrait de droit ou une
    // desactivation de compte soit effectif immediatement, sans reconnexion.
    const payload: JwtPayload = {
      sub: user.Id,
      employeeId: user.employee.Id,
      roleName: user.role.Name,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }
}
