import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let adminUserId: string;
  let devUserId: string;
  let devId: string;
  let adminToken: string;
  let devToken: string;
  let projectId: string;
  let taskId: string;
  let workingStatusId: string;
  let activityId: string;

  async function createUser(email: string, role: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Dash',
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

    adminUserId = await createUser(
      `dashboard-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );
    devUserId = await createUser(
      `dashboard-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    devId = (await prisma.developer.create({ data: { userId: devUserId } })).id;

    adminToken = await login(`dashboard-e2e-admin-${suffix}@devoffice.local`);
    devToken = await login(`dashboard-e2e-dev-${suffix}@devoffice.local`);

    const project = await prisma.project.create({
      data: { name: 'Dashboard E2E', code: `DASH-E2E-${suffix}` },
    });
    projectId = project.id;
    const task = await prisma.task.create({
      data: {
        code: `DASH-E2E-${suffix}-1`,
        title: 'Test task',
        projectId,
        createdById: adminUserId,
      },
    });
    taskId = task.id;

    const working = await prisma.developerStatus.findUniqueOrThrow({
      where: { code: 'WORKING' },
    });
    workingStatusId = working.id;
  });

  afterAll(async () => {
    const userIds = [adminUserId, devUserId];
    await prisma.developerActivity.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project
      .delete({ where: { id: projectId } })
      .catch(() => undefined);
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.developer.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('rejects GET /api/dashboard/summary without a token', () => {
    return request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .expect(401);
  });

  it('returns a summary with total developers and no active activity for our dev yet', () => {
    return request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.totalDevelopers).toBeGreaterThanOrEqual(1);
        expect(res.body.data.byStatus).toEqual(expect.any(Array));
        expect(typeof res.body.data.withoutActivity).toBe('number');
      });
  });

  it('starts an activity for the dev and reflects it in summary + active-activities', async () => {
    const startRes = await request(app.getHttpServer())
      .post('/api/activities')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ statusId: workingStatusId, taskId, description: 'dashboard e2e' })
      .expect(201);
    activityId = startRes.body.data.id;

    const summary = await request(app.getHttpServer())
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const workingEntry = summary.body.data.byStatus.find(
      (s: { code: string }) => s.code === 'WORKING',
    );
    expect(workingEntry.count).toBeGreaterThanOrEqual(1);

    const active = await request(app.getHttpServer())
      .get('/api/dashboard/active-activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(active.body.data.some((d: { id: string }) => d.id === devId)).toBe(
      true,
    );
  });

  it('reflects finished activity duration in activity-distribution and productivity', async () => {
    await request(app.getHttpServer())
      .post(`/api/activities/${activityId}/finish`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({})
      .expect(200);

    const distribution = await request(app.getHttpServer())
      .get('/api/dashboard/activity-distribution')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const workingBucket = distribution.body.data.find(
      (d: { status: { code: string } }) => d.status.code === 'WORKING',
    );
    expect(workingBucket).toBeDefined();
    expect(workingBucket.totalSeconds).toEqual(expect.any(Number));

    const productivity = await request(app.getHttpServer())
      .get('/api/dashboard/productivity')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const devEntry = productivity.body.data.find(
      (p: { developerId: string }) => p.developerId === devId,
    );
    expect(devEntry).toBeDefined();
    // WORKING is isProductive: true, so all of this developer's counted time (however
    // small, given the test finishes almost instantly) must be attributed as productive.
    expect(devEntry.productiveSeconds).toBe(devEntry.totalSeconds);
    expect(devEntry.productivityRate).toBeGreaterThanOrEqual(0);
    expect(devEntry.productivityRate).toBeLessThanOrEqual(1);
  });

  it('forbids a DEVELOPER from viewing productivity', () => {
    return request(app.getHttpServer())
      .get('/api/dashboard/productivity')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(403)
      .expect((res) => {
        expect(res.body.error.code).toBe('INSUFFICIENT_ROLE');
      });
  });
});
