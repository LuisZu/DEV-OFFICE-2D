import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Statuses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';
  const statusCode = `E2E_STATUS_${suffix}`;

  let adminUserId: string;
  let developerUserId: string;
  let adminToken: string;
  let developerToken: string;
  let createdStatusId: string;

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
      `statuses-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );
    developerUserId = await createUserWithRole(
      `statuses-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );

    adminToken = await login(`statuses-e2e-admin-${suffix}@devoffice.local`);
    developerToken = await login(`statuses-e2e-dev-${suffix}@devoffice.local`);
  });

  afterAll(async () => {
    if (createdStatusId) {
      await prisma.developerStatus
        .delete({ where: { id: createdStatusId } })
        .catch(() => undefined);
    }
    const userIds = [adminUserId, developerUserId];
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects GET without a token', () => {
    return request(app.getHttpServer()).get('/api/statuses').expect(401);
  });

  it('lists the seeded statuses for any authenticated role', () => {
    return request(app.getHttpServer())
      .get('/api/statuses')
      .set('Authorization', `Bearer ${developerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.length).toBeGreaterThanOrEqual(10);
        expect(
          res.body.data.some((s: { code: string }) => s.code === 'WORKING'),
        ).toBe(true);
      });
  });

  it('forbids a DEVELOPER from creating a status', () => {
    return request(app.getHttpServer())
      .post('/api/statuses')
      .set('Authorization', `Bearer ${developerToken}`)
      .send({ code: statusCode, name: 'Nope' })
      .expect(403);
  });

  it('allows an ADMIN to create a status', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/statuses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: statusCode, name: 'E2E Status', requiresTask: true })
      .expect(201);

    expect(res.body.data).toMatchObject({
      code: statusCode,
      requiresTask: true,
      isActive: true,
    });
    createdStatusId = res.body.data.id;
  });

  it('rejects a duplicate status code with 409', () => {
    return request(app.getHttpServer())
      .post('/api/statuses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: statusCode, name: 'Duplicate' })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('STATUS_CODE_ALREADY_EXISTS');
      });
  });

  it('allows an ADMIN to update a status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/statuses/${createdStatusId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Status Updated' })
      .expect(200);

    expect(res.body.data.name).toBe('E2E Status Updated');
  });

  it('deactivates a status on DELETE', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/statuses/${createdStatusId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.isActive).toBe(false);
  });
});
