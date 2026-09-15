import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Activities (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let adminUserId: string;
  let dev1UserId: string;
  let dev2UserId: string;
  let dev3UserId: string;
  let dev1Id: string;
  let dev3Id: string;
  let adminToken: string;
  let dev1Token: string;
  let dev2Token: string;
  let dev3Token: string;

  let projectId: string;
  let taskId: string;
  let workingStatusId: string;
  let coffeeStatusId: string;

  async function createUser(email: string, role: string) {
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

    adminUserId = await createUser(
      `activities-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );
    dev1UserId = await createUser(
      `activities-e2e-dev1-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    dev2UserId = await createUser(
      `activities-e2e-dev2-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    dev3UserId = await createUser(
      `activities-e2e-dev3-${suffix}@devoffice.local`,
      'DEVELOPER',
    );

    dev1Id = (await prisma.developer.create({ data: { userId: dev1UserId } }))
      .id;
    await prisma.developer.create({ data: { userId: dev2UserId } });
    dev3Id = (await prisma.developer.create({ data: { userId: dev3UserId } }))
      .id;

    adminToken = await login(`activities-e2e-admin-${suffix}@devoffice.local`);
    dev1Token = await login(`activities-e2e-dev1-${suffix}@devoffice.local`);
    dev2Token = await login(`activities-e2e-dev2-${suffix}@devoffice.local`);
    dev3Token = await login(`activities-e2e-dev3-${suffix}@devoffice.local`);

    const project = await prisma.project.create({
      data: { name: 'Activities E2E', code: `ACT-E2E-${suffix}` },
    });
    projectId = project.id;

    const task = await prisma.task.create({
      data: {
        code: `ACT-E2E-${suffix}-1`,
        title: 'Test task',
        projectId,
        createdById: adminUserId,
      },
    });
    taskId = task.id;

    const working = await prisma.developerStatus.findUniqueOrThrow({
      where: { code: 'WORKING' },
    });
    const coffee = await prisma.developerStatus.findUniqueOrThrow({
      where: { code: 'COFFEE' },
    });
    workingStatusId = working.id;
    coffeeStatusId = coffee.id;
  });

  afterAll(async () => {
    const userIds = [adminUserId, dev1UserId, dev2UserId, dev3UserId];
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

  describe('GET /api/activities/current', () => {
    it('returns null when there is no active activity', () => {
      return request(app.getHttpServer())
        .get('/api/activities/current')
        .set('Authorization', `Bearer ${dev1Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeNull();
        });
    });
  });

  describe('POST /api/activities', () => {
    it('forbids a non-developer account (no Developer record) from starting one', () => {
      return request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ statusId: coffeeStatusId })
        .expect(403)
        .expect((res) => {
          expect(res.body.error.code).toBe('NOT_A_DEVELOPER');
        });
    });

    it('rejects a task-requiring status without a taskId', () => {
      return request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({ statusId: workingStatusId })
        .expect(400)
        .expect((res) => {
          expect(res.body.error.code).toBe('TASK_REQUIRED_FOR_STATUS');
        });
    });

    it('starts an activity with a valid status + task', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({
          statusId: workingStatusId,
          taskId,
          description: 'Implementando login',
        })
        .expect(201);

      expect(res.body.data).toMatchObject({
        status: { code: 'WORKING' },
        task: { id: taskId },
        endedAt: null,
      });
    });

    it('reflects the started activity on GET /current', () => {
      return request(app.getHttpServer())
        .get('/api/activities/current')
        .set('Authorization', `Bearer ${dev1Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status.code).toBe('WORKING');
        });
    });

    it('rejects starting a second activity while one is already active (functional check)', () => {
      return request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({ statusId: coffeeStatusId })
        .expect(409)
        .expect((res) => {
          expect(res.body.error.code).toBe('ACTIVE_ACTIVITY_EXISTS');
          expect(res.body.error.message).toBe(
            'The developer already has an active activity.',
          );
        });
    });
  });

  describe('POST /api/activities/current/change-status', () => {
    it('finishes the current activity and starts a new one with the new status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/activities/current/change-status')
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({ statusId: coffeeStatusId, description: 'Café' })
        .expect(200);

      expect(res.body.data.status.code).toBe('COFFEE');
      expect(res.body.data.task).toBeNull();
    });

    it('returns 404 NO_ACTIVE_ACTIVITY for a developer with nothing active', () => {
      return request(app.getHttpServer())
        .post('/api/activities/current/change-status')
        .set('Authorization', `Bearer ${dev2Token}`)
        .send({ statusId: coffeeStatusId })
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('NO_ACTIVE_ACTIVITY');
        });
    });
  });

  describe('POST /api/activities current/change-task', () => {
    it('rotates the current activity onto a new task, keeping the same status', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/activities/current/change-task')
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({ taskId })
        .expect(200);

      expect(res.body.data.status.code).toBe('COFFEE');
      expect(res.body.data.task).toMatchObject({ id: taskId });
    });
  });

  describe('POST /api/activities/:id/finish', () => {
    let activityIdToFinish: string;

    beforeAll(async () => {
      const current = await request(app.getHttpServer())
        .get('/api/activities/current')
        .set('Authorization', `Bearer ${dev1Token}`);
      activityIdToFinish = current.body.data.id;
    });

    it("forbids a different developer from finishing someone else's activity", () => {
      return request(app.getHttpServer())
        .post(`/api/activities/${activityIdToFinish}/finish`)
        .set('Authorization', `Bearer ${dev2Token}`)
        .send({})
        .expect(403)
        .expect((res) => {
          expect(res.body.error.code).toBe('UNAUTHORIZED_ACTIVITY_ACCESS');
        });
    });

    it('allows the owner to finish it, appending the note and computing duration', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/activities/${activityIdToFinish}/finish`)
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({ note: 'Listo por hoy' })
        .expect(200);

      expect(res.body.data.endedAt).not.toBeNull();
      expect(res.body.data.durationSeconds).toEqual(expect.any(Number));
      expect(res.body.data.description).toContain('Listo por hoy');
    });

    it('rejects finishing an already-finished activity', () => {
      return request(app.getHttpServer())
        .post(`/api/activities/${activityIdToFinish}/finish`)
        .set('Authorization', `Bearer ${dev1Token}`)
        .send({})
        .expect(409)
        .expect((res) => {
          expect(res.body.error.code).toBe('ACTIVITY_ALREADY_FINISHED');
        });
    });
  });

  describe('GET /api/developers/:id/activities and /api/activities filters', () => {
    it('lists the finished activity in the developer-scoped history', () => {
      return request(app.getHttpServer())
        .get(`/api/developers/${dev1Id}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
          expect(
            res.body.data.items.every(
              (a: { developer: { id: string } }) => a.developer.id === dev1Id,
            ),
          ).toBe(true);
        });
    });

    it('filters the global activity list by status', () => {
      return request(app.getHttpServer())
        .get(`/api/activities?statusId=${coffeeStatusId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(
            res.body.data.items.every(
              (a: { status: { id: string } }) => a.status.id === coffeeStatusId,
            ),
          ).toBe(true);
        });
    });
  });

  describe('Concurrency: only one active activity per developer (spec section 40)', () => {
    it('accepts exactly one of two simultaneous start requests for the same developer', async () => {
      const attempt = () =>
        request(app.getHttpServer())
          .post('/api/activities')
          .set('Authorization', `Bearer ${dev3Token}`)
          .send({ statusId: coffeeStatusId, description: 'race' });

      const [resA, resB] = await Promise.all([attempt(), attempt()]);
      const statuses = [resA.status, resB.status].sort();

      expect(statuses).toEqual([201, 409]);

      const conflictResponse = resA.status === 409 ? resA : resB;
      expect(conflictResponse.body.error.code).toBe('ACTIVE_ACTIVITY_EXISTS');

      const activeCount = await prisma.developerActivity.count({
        where: { developerId: dev3Id, endedAt: null },
      });
      expect(activeCount).toBe(1);
    });
  });
});
