import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Developers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let adminUserId: string;
  let managerUserId: string;
  let developerUserId: string;
  let adminToken: string;
  let managerToken: string;
  let developerToken: string;

  const createdDeveloperIds: string[] = [];
  const createdUserIds: string[] = [];

  async function createUserWithRole(email: string, role: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Test',
        lastName: role,
        roleAssignments: { create: [{ role }] },
      },
    });
    if (role === 'DEVELOPER') {
      await prisma.developer.create({ data: { userId: user.id } });
    }
    return user.id;
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password });
    return res.body.data.accessToken;
  }

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

    adminUserId = await createUserWithRole(
      `developers-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );
    managerUserId = await createUserWithRole(
      `developers-e2e-manager-${suffix}@devoffice.local`,
      'MANAGER',
    );
    developerUserId = await createUserWithRole(
      `developers-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    createdUserIds.push(adminUserId, managerUserId, developerUserId);

    adminToken = await login(`developers-e2e-admin-${suffix}@devoffice.local`);
    managerToken = await login(
      `developers-e2e-manager-${suffix}@devoffice.local`,
    );
    developerToken = await login(
      `developers-e2e-dev-${suffix}@devoffice.local`,
    );
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.developer.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await app.close();
  });

  describe('GET /api/developers', () => {
    it('rejects requests without a token', () => {
      return request(app.getHttpServer()).get('/api/developers').expect(401);
    });

    it('returns a paginated list for any authenticated role', () => {
      return request(app.getHttpServer())
        .get('/api/developers')
        .set('Authorization', `Bearer ${developerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toEqual(expect.any(Array));
          expect(res.body.data.meta).toMatchObject({ page: 1, limit: 20 });
          expect(res.body.data.meta.total).toBeGreaterThanOrEqual(3);
        });
    });

    it('respects page/limit query params', () => {
      return request(app.getHttpServer())
        .get('/api/developers?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items).toHaveLength(1);
          expect(res.body.data.meta.limit).toBe(1);
        });
    });
  });

  describe('GET /api/developers/:id', () => {
    it('returns 404 for a well-formed but unknown id', () => {
      return request(app.getHttpServer())
        .get('/api/developers/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('DEVELOPER_NOT_FOUND');
        });
    });

    it('returns 400 for a malformed id', () => {
      return request(app.getHttpServer())
        .get('/api/developers/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('POST /api/developers (permissions)', () => {
    it('forbids a DEVELOPER from creating a new developer', () => {
      return request(app.getHttpServer())
        .post('/api/developers')
        .set('Authorization', `Bearer ${developerToken}`)
        .send({
          email: `should-not-be-created-${suffix}@devoffice.local`,
          password,
          firstName: 'Nope',
          lastName: 'Nope',
        })
        .expect(403)
        .expect((res) => {
          expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
        });
    });

    it('allows an ADMIN to create a new developer', async () => {
      const email = `developers-e2e-created-${suffix}@devoffice.local`;
      const res = await request(app.getHttpServer())
        .post('/api/developers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, password, firstName: 'Laura', lastName: 'Fernández' })
        .expect(201);

      expect(res.body.data).toMatchObject({
        email,
        firstName: 'Laura',
        lastName: 'Fernández',
        isActive: true,
      });
      createdDeveloperIds.push(res.body.data.id);
      createdUserIds.push(res.body.data.userId);
    });

    it('rejects a duplicate email with 409', async () => {
      const email = `developers-e2e-created-${suffix}@devoffice.local`;
      return request(app.getHttpServer())
        .post('/api/developers')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          email,
          password,
          firstName: 'Duplicate',
          lastName: 'Duplicate',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
        });
    });
  });

  describe('PATCH /api/developers/:id', () => {
    it('forbids a DEVELOPER from updating another developer', () => {
      return request(app.getHttpServer())
        .patch(`/api/developers/${createdDeveloperIds[0]}`)
        .set('Authorization', `Bearer ${developerToken}`)
        .send({ firstName: 'Hacked' })
        .expect(403);
    });

    it('allows a MANAGER to update a developer', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/developers/${createdDeveloperIds[0]}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ firstName: 'LauraUpdated' })
        .expect(200);

      expect(res.body.data.firstName).toBe('LauraUpdated');
    });
  });

  describe('DELETE /api/developers/:id', () => {
    it('deactivates the developer (soft delete) instead of removing the row', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/developers/${createdDeveloperIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.isActive).toBe(false);

      const fetched = await request(app.getHttpServer())
        .get(`/api/developers/${createdDeveloperIds[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(fetched.body.data.isActive).toBe(false);
    });

    it('prevents the deactivated developer from logging in', () => {
      const email = `developers-e2e-created-${suffix}@devoffice.local`;
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(401)
        .expect((res) => {
          expect(res.body.error.code).toBe('USER_INACTIVE');
        });
    });
  });
});
