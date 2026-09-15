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

describe('OfficeGateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let devUserId: string;
  let devId: string;
  let devToken: string;
  let projectId: string;
  let taskId: string;
  let coffeeStatusId: string;

  const openSockets: ClientSocket[] = [];

  function connectSocket(token?: string): ClientSocket {
    const socket = io(`${baseUrl}/office`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    openSockets.push(socket);
    return socket;
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

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: `office-e2e-dev-${suffix}@devoffice.local`,
        passwordHash,
        firstName: 'Office',
        lastName: 'E2E',
        roleAssignments: { create: [{ role: 'DEVELOPER' }] },
      },
    });
    devUserId = user.id;
    devId = (await prisma.developer.create({ data: { userId: devUserId } })).id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `office-e2e-dev-${suffix}@devoffice.local`, password });
    devToken = loginRes.body.data.accessToken;

    const project = await prisma.project.create({
      data: { name: 'Office E2E', code: `OFFICE-E2E-${suffix}` },
    });
    projectId = project.id;
    const task = await prisma.task.create({
      data: {
        code: `OFFICE-E2E-${suffix}-1`,
        title: 'Test task',
        projectId,
        createdById: devUserId,
      },
    });
    taskId = task.id;

    const coffee = await prisma.developerStatus.findUniqueOrThrow({
      where: { code: 'COFFEE' },
    });
    coffeeStatusId = coffee.id;
  });

  afterEach(() => {
    while (openSockets.length) {
      openSockets.pop()?.disconnect();
    }
  });

  afterAll(async () => {
    await prisma.developerActivity.deleteMany({ where: { userId: devUserId } });
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.project
      .delete({ where: { id: projectId } })
      .catch(() => undefined);
    await prisma.refreshToken.deleteMany({ where: { userId: devUserId } });
    await prisma.developer.deleteMany({ where: { userId: devUserId } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: devUserId },
    });
    await prisma.user.deleteMany({ where: { id: devUserId } });
    await app.close();
  });

  it('accepts a connection authenticated with a valid access token', (done) => {
    const socket = connectSocket(devToken);
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      done();
    });
    socket.on('connect_error', (err) => done(err));
  });

  // The server rejects unauthenticated sockets from inside handleConnection, which
  // runs *after* the Socket.IO handshake already completed — so the client briefly
  // sees 'connect' before the server-initiated 'disconnect' arrives. What matters is
  // that the socket ends up (and stays) disconnected, not that 'connect' never fires.
  it('rejects a connection with no token', (done) => {
    const socket = connectSocket();
    socket.once('disconnect', () => {
      expect(socket.connected).toBe(false);
      done();
    });
  });

  it('rejects a connection with a garbage token', (done) => {
    const socket = connectSocket('not-a-real-token');
    socket.once('disconnect', () => {
      expect(socket.connected).toBe(false);
      done();
    });
  });

  it('responds to office.sync.request with a snapshot including the connected developer', (done) => {
    const socket = connectSocket(devToken);
    socket.on('connect', () => {
      socket.emit(OFFICE_EVENTS.SYNC_REQUEST);
    });
    socket.on(OFFICE_EVENTS.SYNC_RESPONSE, (snapshot) => {
      expect(snapshot.serverTime).toEqual(expect.any(String));
      expect(
        snapshot.developers.some((d: { id: string }) => d.id === devId),
      ).toBe(true);
      done();
    });
  });

  it('broadcasts developer.activity.started when the developer starts an activity via REST', (done) => {
    const socket = connectSocket(devToken);

    socket.on(OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED, (payload) => {
      expect(payload.developerId).toBe(devId);
      expect(payload.status.code).toBe('COFFEE');
      done();
    });

    socket.on('connect', () => {
      request(app.getHttpServer())
        .post('/api/activities')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ statusId: coffeeStatusId, description: 'socket test' })
        .end((err) => {
          if (err) done(err);
        });
    });
  });

  it('broadcasts developer.status.changed on change-status', (done) => {
    const socket = connectSocket(devToken);

    socket.on(OFFICE_EVENTS.DEVELOPER_STATUS_CHANGED, (payload) => {
      expect(payload.developerId).toBe(devId);
      expect(payload.task).toMatchObject({ id: taskId });
      done();
    });

    socket.on('connect', () => {
      request(app.getHttpServer())
        .post('/api/activities/current/change-status')
        .set('Authorization', `Bearer ${devToken}`)
        .send({ statusId: coffeeStatusId, taskId })
        .end((err) => {
          if (err) done(err);
        });
    });
  });
});
