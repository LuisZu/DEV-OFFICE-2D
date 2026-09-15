import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let adminUserId: string;
  let developer1UserId: string;
  let developer2UserId: string;
  let developer1Id: string;
  let adminToken: string;
  let developer1Token: string;
  let developer2Token: string;
  let projectId: string;
  let taskId: string;

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
      `tasks-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );
    developer1UserId = await createUser(
      `tasks-e2e-dev1-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    developer2UserId = await createUser(
      `tasks-e2e-dev2-${suffix}@devoffice.local`,
      'DEVELOPER',
    );

    const dev1 = await prisma.developer.create({
      data: { userId: developer1UserId },
    });
    await prisma.developer.create({ data: { userId: developer2UserId } });
    developer1Id = dev1.id;

    adminToken = await login(`tasks-e2e-admin-${suffix}@devoffice.local`);
    developer1Token = await login(`tasks-e2e-dev1-${suffix}@devoffice.local`);
    developer2Token = await login(`tasks-e2e-dev2-${suffix}@devoffice.local`);

    const project = await prisma.project.create({
      data: { name: 'Tasks E2E Project', code: `TASKS-E2E-${suffix}` },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    const userIds = [adminUserId, developer1UserId, developer2UserId];
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

  describe('POST /api/tasks', () => {
    it('forbids a DEVELOPER from creating a task', () => {
      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${developer1Token}`)
        .send({ code: `T-${suffix}-X`, title: 'Nope', projectId })
        .expect(403);
    });

    it('rejects an unknown projectId with 404', () => {
      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `T-${suffix}-BADPROJ`,
          title: 'Bad project',
          projectId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
        });
    });

    it('rejects an unknown assignedToId with 404', () => {
      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: `T-${suffix}-BADDEV`,
          title: 'Bad assignee',
          projectId,
          assignedToId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404)
        .expect((res) => {
          expect(res.body.error.code).toBe('DEVELOPER_NOT_FOUND');
        });
    });

    it('creates a task with default status TODO and priority MEDIUM', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `T-${suffix}-1`, title: 'Implement login', projectId })
        .expect(201);

      expect(res.body.data).toMatchObject({
        status: 'TODO',
        priority: 'MEDIUM',
        title: 'Implement login',
      });
      expect(res.body.data.project).toMatchObject({ id: projectId });
      taskId = res.body.data.id;
    });

    it('rejects a duplicate task code with 409', () => {
      return request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `T-${suffix}-1`, title: 'Duplicate', projectId })
        .expect(409)
        .expect((res) => {
          expect(res.body.error.code).toBe('TASK_CODE_ALREADY_EXISTS');
        });
    });
  });

  describe('GET /api/tasks', () => {
    it('filters by projectId and status', () => {
      return request(app.getHttpServer())
        .get(`/api/tasks?projectId=${projectId}&status=TODO`)
        .set('Authorization', `Bearer ${developer1Token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
          expect(
            res.body.data.items.every(
              (t: { status: string }) => t.status === 'TODO',
            ),
          ).toBe(true);
        });
    });
  });

  describe('POST /api/tasks/:id/assign', () => {
    it('forbids a DEVELOPER from assigning tasks', () => {
      return request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${developer1Token}`)
        .send({ developerId: developer1Id })
        .expect(403);
    });

    it('assigns the task to developer1', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ developerId: developer1Id })
        .expect(200);

      expect(res.body.data.assignedTo).toMatchObject({ id: developer1Id });
    });

    it('unassigns the task when developerId is null', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ developerId: null })
        .expect(200);

      expect(res.body.data.assignedTo).toBeNull();

      // re-assign for the status tests below
      await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ developerId: developer1Id })
        .expect(200);
    });
  });

  describe('POST /api/tasks/:id/status', () => {
    it('allows the assigned developer to change the status', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${developer1Token}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('forbids a different developer (not the assignee) from changing the status', () => {
      return request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${developer2Token}`)
        .send({ status: 'DONE' })
        .expect(403)
        .expect((res) => {
          expect(res.body.error.code).toBe('NOT_TASK_OWNER');
        });
    });

    it('allows an ADMIN to change the status regardless of assignment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DONE' })
        .expect(200);

      expect(res.body.data.status).toBe('DONE');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('hard-deletes the task', async () => {
      await request(app.getHttpServer())
        .delete(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toEqual({ deleted: true });
        });

      await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
