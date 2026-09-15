import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testEmail = `auth-e2e-${Date.now()}@devoffice.local`;
  const testPassword = 'TestPassword#123';
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        firstName: 'Auth',
        lastName: 'E2E',
        roleAssignments: { create: [{ role: 'DEVELOPER' }] },
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.delete({ where: { id: testUserId } });
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('rejects an unknown email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@devoffice.local', password: testPassword })
        .expect(401)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
        });
    });

    it('rejects a wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'wrong-password' })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
        });
    });

    it('rejects a malformed payload (validation pipe)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: testPassword })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('BAD_REQUEST');
        });
    });

    it('logs in with valid credentials and returns a token pair + safe user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.accessToken).toEqual(expect.any(String));
          expect(res.body.data.refreshToken).toEqual(expect.any(String));
          expect(res.body.data.user).toMatchObject({
            id: testUserId,
            email: testEmail,
            roles: ['DEVELOPER'],
          });
          expect(res.body.data.user.passwordHash).toBeUndefined();
        });
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects a request without a token', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('rejects a garbage token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('returns the current user profile for a valid token', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toMatchObject({
            id: testUserId,
            email: testEmail,
            roles: ['DEVELOPER'],
          });
        });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('issues a new token pair and rotates the refresh token (old one becomes unusable)', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });
      const oldRefreshToken = login.body.data.refreshToken;

      const refreshed = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(200);

      expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
      expect(refreshed.body.data.refreshToken).not.toBe(oldRefreshToken);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
        });
    });

    it('rejects an unknown/invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('requires authentication', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({})
        .expect(401);
    });

    it('revokes the given refresh token so it can no longer be used', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });
      const { accessToken, refreshToken } = login.body.data;

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toEqual({ loggedOut: true });
        });

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
