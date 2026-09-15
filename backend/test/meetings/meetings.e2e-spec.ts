import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Meetings (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let devUserId: string;
  let devId: string;
  let devToken: string;
  let meetingId: string;

  async function createUser(email: string, role: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Meet',
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

    devUserId = await createUser(
      `meetings-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    devId = (await prisma.developer.create({ data: { userId: devUserId } })).id;
    devToken = await login(`meetings-e2e-dev-${suffix}@devoffice.local`);
  });

  afterAll(async () => {
    const userIds = [devUserId];
    if (meetingId) {
      await prisma.meetingParticipant.deleteMany({ where: { meetingId } });
      await prisma.meeting
        .delete({ where: { id: meetingId } })
        .catch(() => undefined);
    }
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

  it('rejects GET /api/meetings without a token', () => {
    return request(app.getHttpServer()).get('/api/meetings').expect(401);
  });

  it('creates a meeting with no startedAt/endedAt yet', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/meetings')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ title: 'Daily standup', description: 'e2e' })
      .expect(201);

    expect(res.body.data).toMatchObject({
      title: 'Daily standup',
      startedAt: null,
      endedAt: null,
      participants: [],
    });
    meetingId = res.body.data.id;
  });

  it('rejects finishing a meeting that has not started', () => {
    return request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/finish`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEETING_NOT_STARTED');
      });
  });

  it('rejects adding an unknown developer as a participant', () => {
    return request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/participants`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ developerId: '00000000-0000-0000-0000-000000000000' })
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('DEVELOPER_NOT_FOUND');
      });
  });

  it('adds a participant', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/participants`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ developerId: devId })
      .expect(201);

    expect(
      res.body.data.participants.some(
        (p: { developer: { id: string } }) => p.developer.id === devId,
      ),
    ).toBe(true);
  });

  it('rejects adding the same participant twice', () => {
    return request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/participants`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ developerId: devId })
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('PARTICIPANT_ALREADY_ADDED');
      });
  });

  it('starts the meeting', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/start`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);

    expect(res.body.data.startedAt).not.toBeNull();
  });

  it('rejects starting an already-started meeting', () => {
    return request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/start`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEETING_ALREADY_STARTED');
      });
  });

  it('removes a participant', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/meetings/${meetingId}/participants/${devId}`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);

    expect(res.body.data.participants).toHaveLength(0);
  });

  it('rejects removing a participant that is not in the meeting', () => {
    return request(app.getHttpServer())
      .delete(`/api/meetings/${meetingId}/participants/${devId}`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('PARTICIPANT_NOT_FOUND');
      });
  });

  it('finishes the meeting', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/finish`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);

    expect(res.body.data.endedAt).not.toBeNull();
  });

  it('rejects finishing an already-finished meeting', () => {
    return request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/finish`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(409)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEETING_ALREADY_FINISHED');
      });
  });

  it('returns 404 for an unknown meeting id', () => {
    return request(app.getHttpServer())
      .get('/api/meetings/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('MEETING_NOT_FOUND');
      });
  });

  it('lists meetings with pagination', () => {
    return request(app.getHttpServer())
      .get('/api/meetings?limit=5')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.items).toEqual(expect.any(Array));
        expect(res.body.data.meta.limit).toBe(5);
      });
  });
});
