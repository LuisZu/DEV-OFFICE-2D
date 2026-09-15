import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';
  const projectCode = `E2E-${suffix}`;

  let adminUserId: string;
  let developerUserId: string;
  let adminToken: string;
  let developerToken: string;
  let createdProjectId: string;

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
      `projects-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );
    developerUserId = await createUserWithRole(
      `projects-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );

    adminToken = await login(`projects-e2e-admin-${suffix}@devoffice.local`);
    developerToken = await login(`projects-e2e-dev-${suffix}@devoffice.local`);
  });

  afterAll(async () => {
    if (createdProjectId) {
      await prisma.project
        .delete({ where: { id: createdProjectId } })
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
    return request(app.getHttpServer()).get('/api/projects').expect(401);
  });

  it('forbids a DEVELOPER from creating a project', () => {
    return request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${developerToken}`)
      .send({ name: 'Nope', code: `NOPE-${suffix}` })
      .expect(403);
  });

  it('allows an ADMIN to create a project', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Project',
        code: projectCode,
        description: 'Created by tests',
      })
      .expect(201);

    expect(res.body.data).toMatchObject({
      name: 'E2E Project',
      code: projectCode,
      isActive: true,
    });
    createdProjectId = res.body.data.id;
  });

  it('rejects a duplicate project code with 409', () => {
    return request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', code: projectCode })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('PROJECT_CODE_ALREADY_EXISTS');
      });
  });

  it('returns 404 for an unknown project id', () => {
    return request(app.getHttpServer())
      .get('/api/projects/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
      });
  });

  it('lists projects with pagination for any authenticated role', () => {
    return request(app.getHttpServer())
      .get('/api/projects?limit=1')
      .set('Authorization', `Bearer ${developerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.meta.limit).toBe(1);
      });
  });

  it('allows an ADMIN to update a project', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated description' })
      .expect(200);

    expect(res.body.data.description).toBe('Updated description');
  });

  it('archives (soft-deletes) a project on DELETE', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/projects/${createdProjectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.isActive).toBe(false);
  });
});
