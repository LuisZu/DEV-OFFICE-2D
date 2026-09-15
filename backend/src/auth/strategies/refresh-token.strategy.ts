import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

export interface RefreshTokenRequestUser {
  userId: string;
  tokenRecordId: string;
}

const INVALID_REFRESH_TOKEN = {
  code: 'INVALID_REFRESH_TOKEN',
  message: 'Refresh token is invalid, expired or has already been used.',
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: Request,
    payload: RefreshTokenPayload,
  ): Promise<RefreshTokenRequestUser> {
    const rawToken = (req.body as { refreshToken?: string })?.refreshToken;

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (
      !record ||
      record.userId !== payload.sub ||
      record.revokedAt ||
      record.expiresAt < new Date()
    ) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    const hash = createHash('sha256')
      .update(rawToken ?? '')
      .digest('hex');
    if (hash !== record.tokenHash) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    return { userId: payload.sub, tokenRecordId: payload.jti };
  }
}
