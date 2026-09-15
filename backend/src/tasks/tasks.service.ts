import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UserRole } from '../common/enums';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';

const taskInclude = {
  project: { select: { id: true, code: true, name: true } },
  assignedTo: {
    select: {
      id: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryTasksDto,
  ): Promise<PaginatedResult<TaskWithRelations>> {
    const { page, limit, projectId, assignedToId, status, priority } = query;
    const where: Prisma.TaskWhereInput = {
      ...(projectId && { projectId }),
      ...(assignedToId && { assignedToId }),
      ...(status && { status }),
      ...(priority && { priority }),
    };

    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<TaskWithRelations> {
    return this.assertFound(
      await this.prisma.task.findUnique({
        where: { id },
        include: taskInclude,
      }),
    );
  }

  async create(
    dto: CreateTaskDto,
    createdById: string,
  ): Promise<TaskWithRelations> {
    const [existingCode, project] = await Promise.all([
      this.prisma.task.findUnique({ where: { code: dto.code } }),
      this.prisma.project.findUnique({ where: { id: dto.projectId } }),
    ]);

    if (existingCode) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'TASK_CODE_ALREADY_EXISTS',
        `A task with code "${dto.code}" already exists.`,
      );
    }
    if (!project) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'PROJECT_NOT_FOUND',
        'Project not found.',
      );
    }
    if (dto.assignedToId) {
      await this.assertDeveloperExists(dto.assignedToId);
    }

    const task = await this.prisma.task.create({
      data: {
        code: dto.code,
        title: dto.title,
        description: dto.description,
        projectId: dto.projectId,
        assignedToId: dto.assignedToId,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdById,
      },
      include: taskInclude,
    });

    return task;
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskWithRelations> {
    await this.findOne(id);

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: taskInclude,
    });
  }

  async assign(id: string, dto: AssignTaskDto): Promise<TaskWithRelations> {
    await this.findOne(id);
    if (dto.developerId) {
      await this.assertDeveloperExists(dto.developerId);
    }

    return this.prisma.task.update({
      where: { id },
      data: { assignedToId: dto.developerId },
      include: taskInclude,
    });
  }

  async changeStatus(
    id: string,
    dto: ChangeTaskStatusDto,
    requester: RequestUser,
  ): Promise<TaskWithRelations> {
    const task = await this.findOne(id);

    const isManager = requester.roles.some(
      (role) => role === UserRole.ADMIN || role === UserRole.MANAGER,
    );
    const isAssignee = task.assignedTo?.user.id === requester.id;

    if (!isManager && !isAssignee) {
      throw new ForbiddenException({
        code: 'NOT_TASK_OWNER',
        message:
          'Only the assigned developer or a manager can change this task status.',
      });
    }

    return this.prisma.task.update({
      where: { id },
      data: { status: dto.status },
      include: taskInclude,
    });
  }

  // Task deletion is safe as a hard delete: DeveloperActivity.taskId is a SetNull FK
  // (unlike Project/Developer, which have NoAction FKs pointing at them), so removing
  // a task never blocks on, or silently destroys, activity history.
  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.task.delete({ where: { id } });
  }

  private async assertDeveloperExists(developerId: string): Promise<void> {
    const developer = await this.prisma.developer.findUnique({
      where: { id: developerId },
    });
    if (!developer) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'DEVELOPER_NOT_FOUND',
        'Developer not found.',
      );
    }
  }

  private assertFound(task: TaskWithRelations | null): TaskWithRelations {
    if (!task) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'TASK_NOT_FOUND',
        'Task not found.',
      );
    }
    return task;
  }
}
