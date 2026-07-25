import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const SALT_ROUNDS = 10;

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
      mustChangePassword: user.MustChangePassword,
    };

    return { accessToken: this.jwtService.sign(payload) };
  }

  // Auto-only (userId vient du JWT, jamais d'un parametre de route) — sert a
  // la fois le changement force apres creation de compte (mot de passe
  // temporaire communique par le RH) et un changement volontaire ulterieur.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { Id: userId },
      include: { employee: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException('Compte introuvable');
    }

    const currentMatches = await bcrypt.compare(dto.currentPassword, user.PasswordHash);
    if (!currentMatches) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const PasswordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { Id: userId },
      data: { PasswordHash, MustChangePassword: false },
    });

    // Le token deja en circulation porte l'ancien mustChangePassword=true —
    // en signer un nouveau evite de compter sur le frontend pour ignorer un
    // flag perime tant que l'ancien JWT n'a pas expire.
    const payload: JwtPayload = {
      sub: user.Id,
      employeeId: user.employee?.Id ?? '',
      roleName: user.role.Name,
      mustChangePassword: false,
    };
    return { accessToken: this.jwtService.sign(payload) };
  }
}
