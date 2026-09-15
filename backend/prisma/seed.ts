import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserRole, TaskStatus, TaskPriority } from '../src/common/enums';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

// Local-dev-only defaults. Never used to seed a shared/staging/prod database —
// override via env vars there.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe#Admin1';
const MANAGER_PASSWORD = process.env.SEED_MANAGER_PASSWORD ?? 'ChangeMe#Manager1';
const DEVELOPER_PASSWORD = process.env.SEED_DEVELOPER_PASSWORD ?? 'ChangeMe#Dev1';

const STATUSES = [
  { code: 'WORKING', name: 'Trabajando', icon: '💻', color: '#22c55e', isProductive: true, requiresTask: true },
  { code: 'COFFEE', name: 'Café', icon: '☕', color: '#a16207', isProductive: false, requiresTask: false },
  { code: 'LUNCH', name: 'Almuerzo', icon: '🍔', color: '#f97316', isProductive: false, requiresTask: false },
  { code: 'BREAK', name: 'Descanso', icon: '🏖', color: '#0ea5e9', isProductive: false, requiresTask: false },
  { code: 'MEETING', name: 'Reunión', icon: '🗣', color: '#eab308', isProductive: true, requiresTask: false },
  { code: 'FOCUS_SESSION', name: 'Sesión de foco', icon: '🎯', color: '#8b5cf6', isProductive: true, requiresTask: true },
  { code: 'TESTING', name: 'Pruebas', icon: '🧪', color: '#14b8a6', isProductive: true, requiresTask: true },
  // #e11d48 (not the original #6366f1 indigo): that shade sat too close to
  // RESEARCH's #3b82f6 blue for colorblind and even normal-vision readers
  // (validate_palette.js: normal-vision ΔE 7.2, below the 15 floor) once both
  // appear in the same view (e.g. the dashboard's activity-distribution chart).
  { code: 'CODE_REVIEW', name: 'Revisión de código', icon: '🔍', color: '#e11d48', isProductive: true, requiresTask: true },
  { code: 'RESEARCH', name: 'Investigación', icon: '📚', color: '#3b82f6', isProductive: true, requiresTask: false },
  { code: 'OFFLINE', name: 'Desconectado', icon: '📴', color: '#6b7280', isProductive: false, requiresTask: false },
];

const DEVELOPERS = [
  { firstName: 'Juan', lastName: 'Pérez', email: 'juan.perez@devoffice.local' },
  { firstName: 'Ana', lastName: 'García', email: 'ana.garcia@devoffice.local' },
  { firstName: 'Carlos', lastName: 'López', email: 'carlos.lopez@devoffice.local' },
  { firstName: 'María', lastName: 'Rodríguez', email: 'maria.rodriguez@devoffice.local' },
];

async function upsertUserWithRole(params: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
}) {
  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: params.email },
    update: {},
    create: {
      email: params.email,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
    },
  });

  await prisma.userRoleAssignment.upsert({
    where: { userId_role: { userId: user.id, role: params.role } },
    update: {},
    create: { userId: user.id, role: params.role },
  });

  return user;
}

async function main() {
  console.log('Seeding statuses...');
  for (const status of STATUSES) {
    await prisma.developerStatus.upsert({
      where: { code: status.code },
      update: status,
      create: status,
    });
  }

  console.log('Seeding admin...');
  await upsertUserWithRole({
    email: 'admin@devoffice.local',
    firstName: 'Admin',
    lastName: 'DevOffice',
    password: ADMIN_PASSWORD,
    role: UserRole.ADMIN,
  });

  console.log('Seeding manager...');
  await upsertUserWithRole({
    email: 'manager@devoffice.local',
    firstName: 'Manager',
    lastName: 'DevOffice',
    password: MANAGER_PASSWORD,
    role: UserRole.MANAGER,
  });

  console.log('Seeding developers...');
  const developers = [];
  for (const dev of DEVELOPERS) {
    const user = await upsertUserWithRole({
      ...dev,
      password: DEVELOPER_PASSWORD,
      role: UserRole.DEVELOPER,
    });

    const developer = await prisma.developer.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    developers.push({ user, developer });
  }

  console.log('Seeding projects...');
  const platformProject = await prisma.project.upsert({
    where: { code: 'DVOF' },
    update: {},
    create: {
      name: 'DevOffice Platform',
      code: 'DVOF',
      description: 'Oficina virtual 2D para el equipo de desarrollo.',
    },
  });

  const mobileProject = await prisma.project.upsert({
    where: { code: 'MOB' },
    update: {},
    create: {
      name: 'Mobile App',
      code: 'MOB',
      description: 'Aplicación móvil complementaria.',
    },
  });

  console.log('Seeding tasks...');
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@devoffice.local' } });

  const tasksData = [
    {
      code: 'DVOF-1',
      title: 'Implementar autenticación',
      description: 'Login, refresh tokens y guards de roles.',
      projectId: platformProject.id,
      assignedToId: developers[0].developer.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
    },
    {
      code: 'DVOF-2',
      title: 'Modelo de datos de actividades',
      description: 'Schema de Prisma + regla de concurrencia.',
      projectId: platformProject.id,
      assignedToId: developers[1].developer.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.CRITICAL,
    },
    {
      code: 'DVOF-3',
      title: 'Gateway de Socket.IO',
      description: 'Rooms, reconexión y sincronización de estado.',
      projectId: platformProject.id,
      assignedToId: null,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
    },
    {
      code: 'MOB-1',
      title: 'Pantalla de login',
      description: 'Consumo del endpoint de autenticación desde la app móvil.',
      projectId: mobileProject.id,
      assignedToId: developers[2].developer.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.MEDIUM,
    },
    {
      code: 'MOB-2',
      title: 'Notificaciones push',
      description: 'Investigación de proveedor de notificaciones.',
      projectId: mobileProject.id,
      assignedToId: developers[3].developer.id,
      status: TaskStatus.BLOCKED,
      priority: TaskPriority.LOW,
    },
  ];

  for (const taskData of tasksData) {
    await prisma.task.upsert({
      where: { code: taskData.code },
      update: {},
      create: { ...taskData, createdById: adminUser.id },
    });
  }

  console.log('Seeding office positions...');
  const deskPositions = [
    { x: 120, y: 160, area: 'desks' },
    { x: 260, y: 160, area: 'desks' },
    { x: 120, y: 280, area: 'desks' },
    { x: 260, y: 280, area: 'desks' },
  ];

  for (let i = 0; i < developers.length; i++) {
    await prisma.officePosition.upsert({
      where: { developerId: developers[i].developer.id },
      update: {},
      create: {
        developerId: developers[i].developer.id,
        ...deskPositions[i],
      },
    });
  }

  console.log('Seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
