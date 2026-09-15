import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import { OFFICE_EVENTS } from '../../src/office/constants/office-events.constant';

describe('Meetings real-time (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let socket: ClientSocket;

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
        firstName: 'MeetRT',
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
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? 0 : address.port;
    baseUrl = `http://127.0.0.1:${port}`;

    prisma = moduleFixture.get(PrismaService);

    devUserId = await createUser(
      `meetings-rt-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    devId = (await prisma.developer.create({ data: { userId: devUserId } })).id;
    devToken = await login(`meetings-rt-e2e-dev-${suffix}@devoffice.local`);

    const meeting = await prisma.meeting.create({
      data: { title: 'RT meeting' },
    });
    meetingId = meeting.id;
  });

  afterAll(async () => {
    socket?.disconnect();
    await prisma.meetingParticipant.deleteMany({ where: { meetingId } });
    await prisma.meeting
      .delete({ where: { id: meetingId } })
      .catch(() => undefined);
    await prisma.refreshToken.deleteMany({ where: { userId: devUserId } });
    await prisma.developer.deleteMany({ where: { userId: devUserId } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: devUserId },
    });
    await prisma.user.deleteMany({ where: { id: devUserId } });
    await app.close();
  });

  it('broadcasts meeting.started, meeting.participant.joined and meeting.finished', async () => {
    socket = io(`${baseUrl}/office`, {
      auth: { token: devToken },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });

    const joined = new Promise((resolve) =>
      socket.once(OFFICE_EVENTS.MEETING_PARTICIPANT_JOINED, resolve),
    );
    await request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/participants`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ developerId: devId })
      .expect(201);
    await expect(joined).resolves.toMatchObject({
      meetingId,
      developerId: devId,
    });

    const started = new Promise((resolve) =>
      socket.once(OFFICE_EVENTS.MEETING_STARTED, resolve),
    );
    await request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/start`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);
    await expect(started).resolves.toMatchObject({
      meetingId,
      participantIds: [devId],
    });

    const finished = new Promise((resolve) =>
      socket.once(OFFICE_EVENTS.MEETING_FINISHED, resolve),
    );
    await request(app.getHttpServer())
      .post(`/api/meetings/${meetingId}/finish`)
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200);
    await expect(finished).resolves.toMatchObject({
      meetingId,
      participantIds: [devId],
    });
  });
});
