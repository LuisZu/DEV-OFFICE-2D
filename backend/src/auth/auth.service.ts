import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as ms from 'ms';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UserRole } from '../common/enums';
import { LoginDto } from './dto/login.dto';
import { User, UserRoleAssignment } from '@prisma/client';

type UserWithRoles = User & { roleAssignments: UserRoleAssignment[] };

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { roleAssignments: true },
    });

    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
      );
    }

    if (!user.isActive) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'USER_INACTIVE',
        'This account has been deactivated.',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
      );
    }

    const tokens = await this.issueTokens(user.id);
    return { ...tokens, user: this.toSafeUser(user) };
  }

  async refresh(userId: string, tokenRecordId: string): Promise<TokenPair> {
    await this.prisma.refreshToken.update({
      where: { id: tokenRecordId },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(userId);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const hash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash: hash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }

    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roleAssignments: true },
    });

    if (!user || !user.isActive) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        'Invalid session.',
      );
    }

    return this.toSafeUser(user);
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiresIn'),
      },
    );

    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const tokenRecord = await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: '',
        expiresAt: new Date(
          Date.now() + ms(refreshExpiresIn as ms.StringValue),
        ),
      },
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: tokenRecord.id },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn,
      },
    );

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { tokenHash: this.hashToken(refreshToken) },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(user: UserWithRoles): RequestUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roleAssignments.map(
        (assignment) => assignment.role as UserRole,
      ),
    };
  }
}
