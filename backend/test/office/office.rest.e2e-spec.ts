import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('Office REST (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const password = 'TestPassword#123';

  let devUserId: string;
  let devId: string;
  let devToken: string;
  let adminUserId: string;
  let adminToken: string;

  async function createUser(email: string, role: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Office',
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
      `office-rest-e2e-dev-${suffix}@devoffice.local`,
      'DEVELOPER',
    );
    devId = (await prisma.developer.create({ data: { userId: devUserId } })).id;
    adminUserId = await createUser(
      `office-rest-e2e-admin-${suffix}@devoffice.local`,
      'ADMIN',
    );

    devToken = await login(`office-rest-e2e-dev-${suffix}@devoffice.local`);
    adminToken = await login(`office-rest-e2e-admin-${suffix}@devoffice.local`);
  });

  afterAll(async () => {
    const userIds = [devUserId, adminUserId];
    await prisma.officePosition.deleteMany({ where: { developerId: devId } });
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

  it('rejects GET /api/office without a token', () => {
    return request(app.getHttpServer()).get('/api/office').expect(401);
  });

  it('returns the office state with areas and developers for any authenticated role', () => {
    return request(app.getHttpServer())
      .get('/api/office')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data.areas).toEqual(
          expect.arrayContaining(['desks', 'coffee', 'meeting']),
        );
        expect(
          res.body.data.developers.some((d: { id: string }) => d.id === devId),
        ).toBe(true);
      });
  });

  it('returns developers with a null position before one is set', () => {
    return request(app.getHttpServer())
      .get('/api/office/developers')
      .set('Authorization', `Bearer ${devToken}`)
      .expect(200)
      .expect((res) => {
        const me = res.body.data.find((d: { id: string }) => d.id === devId);
        expect(me.position).toBeNull();
      });
  });

  it('forbids a DEVELOPER from repositioning a desk', () => {
    return request(app.getHttpServer())
      .patch(`/api/office/developers/${devId}/position`)
      .set('Authorization', `Bearer ${devToken}`)
      .send({ x: 10, y: 20, area: 'desks' })
      .expect(403);
  });

  it('allows an ADMIN to set a developer position, reflected on subsequent reads', async () => {
    await request(app.getHttpServer())
      .patch(`/api/office/developers/${devId}/position`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ x: 42, y: 84, area: 'desks' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toMatchObject({ x: 42, y: 84, area: 'desks' });
      });

    const res = await request(app.getHttpServer())
      .get('/api/office/developers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const me = res.body.data.find((d: { id: string }) => d.id === devId);
    expect(me.position).toMatchObject({ x: 42, y: 84, area: 'desks' });
  });

  it('returns 404 when repositioning an unknown developer', () => {
    return request(app.getHttpServer())
      .patch(
        '/api/office/developers/00000000-0000-0000-0000-000000000000/position',
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ x: 1, y: 1 })
      .expect(404)
      .expect((res) => {
        expect(res.body.error.code).toBe('DEVELOPER_NOT_FOUND');
      });
  });
});
