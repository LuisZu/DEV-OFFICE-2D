import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DeveloperActivity, DeveloperStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UserRole } from '../common/enums';
import { OFFICE_EVENTS } from '../office/constants/office-events.constant';
import { StartActivityDto } from './dto/start-activity.dto';
import { FinishActivityDto } from './dto/finish-activity.dto';
import { ChangeTaskDto } from './dto/change-task.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';

const activityInclude = {
  status: {
    select: { id: true, code: true, name: true, icon: true, color: true },
  },
  task: {
    select: {
      id: true,
      code: true,
      title: true,
      project: { select: { id: true, code: true, name: true } },
    },
  },
  developer: {
    select: {
      id: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.DeveloperActivityInclude;

type ActivityWithRelations = Prisma.DeveloperActivityGetPayload<{
  include: typeof activityInclude;
}>;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    query: QueryActivitiesDto,
  ): Promise<PaginatedResult<ActivityWithRelations>> {
    const where = this.buildWhere(query);
    return this.paginate(where, query.page, query.limit);
  }

  async findByDeveloper(
    developerId: string,
    query: QueryActivitiesDto,
  ): Promise<PaginatedResult<ActivityWithRelations>> {
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

    const where = this.buildWhere({ ...query, developerId });
    return this.paginate(where, query.page, query.limit);
  }

  async findOne(id: string): Promise<ActivityWithRelations> {
    return this.assertFound(
      await this.prisma.developerActivity.findUnique({
        where: { id },
        include: activityInclude,
      }),
    );
  }

  async findCurrent(user: RequestUser): Promise<ActivityWithRelations | null> {
    const developer = await this.getDeveloperOrThrow(user.id);
    return this.prisma.developerActivity.findFirst({
      where: { developerId: developer.id, endedAt: null },
      include: activityInclude,
    });
  }

  async start(
    dto: StartActivityDto,
    user: RequestUser,
  ): Promise<ActivityWithRelations> {
    const developer = await this.getDeveloperOrThrow(user.id);
    await this.validateStatusAndTask(dto.statusId, dto.taskId);

    let activity: ActivityWithRelations;
    try {
      activity = await this.prisma.developerActivity.create({
        data: {
          developerId: developer.id,
          userId: user.id,
          statusId: dto.statusId,
          taskId: dto.taskId,
          description: dto.description,
          startedAt: new Date(),
        },
        include: activityInclude,
      });
    } catch (error) {
      throw this.translateActiveActivityConflict(error);
    }

    this.eventEmitter.emit(OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED, {
      developerId: activity.developerId,
      activityId: activity.id,
      status: activity.status,
      task: activity.task,
      startedAt: activity.startedAt.toISOString(),
    });

    return activity;
  }

  async finish(
    activityId: string,
    dto: FinishActivityDto,
    user: RequestUser,
  ): Promise<ActivityWithRelations> {
    const activity = this.assertFound(
      await this.prisma.developerActivity.findUnique({
        where: { id: activityId },
      }),
    );
    this.assertOwnsActivity(activity, user);

    if (activity.endedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'ACTIVITY_ALREADY_FINISHED',
        'This activity has already been finished.',
      );
    }

    const endedAt = new Date();
    const durationSeconds = this.diffSeconds(activity.startedAt, endedAt);

    const finished = await this.prisma.developerActivity.update({
      where: { id: activityId },
      data: {
        endedAt,
        durationSeconds,
        description: dto.note
          ? this.appendNote(activity.description, dto.note)
          : activity.description,
      },
      include: activityInclude,
    });

    this.eventEmitter.emit(OFFICE_EVENTS.DEVELOPER_ACTIVITY_FINISHED, {
      developerId: finished.developerId,
      activityId: finished.id,
      endedAt: endedAt.toISOString(),
      durationSeconds,
    });

    return finished;
  }

  async changeTask(
    dto: ChangeTaskDto,
    user: RequestUser,
  ): Promise<ActivityWithRelations> {
    const developer = await this.getDeveloperOrThrow(user.id);
    const current = await this.getCurrentActivityOrThrow(developer.id);

    if (dto.taskId) {
      await this.assertTaskExists(dto.taskId);
    }

    const status = await this.prisma.developerStatus.findUniqueOrThrow({
      where: { id: current.statusId },
    });
    if (status.requiresTask && !dto.taskId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TASK_REQUIRED_FOR_STATUS',
        `The status "${status.name}" requires a task.`,
      );
    }

    const rotated = await this.prisma.$transaction((tx) =>
      this.rotateActivity(tx, current, {
        statusId: current.statusId,
        taskId: dto.taskId ?? null,
        description: current.description,
      }),
    );

    this.eventEmitter.emit(OFFICE_EVENTS.DEVELOPER_TASK_CHANGED, {
      developerId: rotated.developerId,
      activityId: rotated.id,
      task: rotated.task,
      startedAt: rotated.startedAt.toISOString(),
    });

    return rotated;
  }

  async changeStatus(
    dto: ChangeStatusDto,
    user: RequestUser,
  ): Promise<ActivityWithRelations> {
    const developer = await this.getDeveloperOrThrow(user.id);
    const current = await this.getCurrentActivityOrThrow(developer.id);
    const status = await this.validateStatusAndTask(dto.statusId, dto.taskId);

    const rotated = await this.prisma.$transaction((tx) =>
      this.rotateActivity(tx, current, {
        statusId: status.id,
        taskId: dto.taskId ?? null,
        description: dto.description ?? current.description,
      }),
    );

    this.eventEmitter.emit(OFFICE_EVENTS.DEVELOPER_STATUS_CHANGED, {
      developerId: rotated.developerId,
      activityId: rotated.id,
      status: rotated.status,
      task: rotated.task,
      startedAt: rotated.startedAt.toISOString(),
    });

    return rotated;
  }

  // --- helpers -------------------------------------------------------------

  private buildWhere(
    query: QueryActivitiesDto,
  ): Prisma.DeveloperActivityWhereInput {
    const { developerId, statusId, taskId, projectId, dateFrom, dateTo } =
      query;
    return {
      ...(developerId && { developerId }),
      ...(statusId && { statusId }),
      ...(taskId && { taskId }),
      ...(projectId && { task: { projectId } }),
      ...((dateFrom || dateTo) && {
        startedAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };
  }

  private async paginate(
    where: Prisma.DeveloperActivityWhereInput,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ActivityWithRelations>> {
    const [total, activities] = await this.prisma.$transaction([
      this.prisma.developerActivity.count({ where }),
      this.prisma.developerActivity.findMany({
        where,
        include: activityInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      items: activities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Rotates the "current" activity: finishes it and opens a new one in its place,
  // atomically. Used by both change-task and change-status (sections 14/15 of the
  // spec), which only differ in which fields carry over vs. change.
  private async rotateActivity(
    tx: Prisma.TransactionClient,
    current: DeveloperActivity,
    next: {
      statusId: string;
      taskId: string | null;
      description: string | null;
    },
  ): Promise<ActivityWithRelations> {
    const endedAt = new Date();

    await tx.developerActivity.update({
      where: { id: current.id },
      data: {
        endedAt,
        durationSeconds: this.diffSeconds(current.startedAt, endedAt),
      },
    });

    try {
      return await tx.developerActivity.create({
        data: {
          developerId: current.developerId,
          userId: current.userId,
          statusId: next.statusId,
          taskId: next.taskId,
          description: next.description,
          startedAt: endedAt,
        },
        include: activityInclude,
      });
    } catch (error) {
      throw this.translateActiveActivityConflict(error);
    }
  }

  private async validateStatusAndTask(
    statusId: string,
    taskId?: string | null,
  ): Promise<DeveloperStatus> {
    const status = await this.prisma.developerStatus.findUnique({
      where: { id: statusId },
    });
    if (!status || !status.isActive) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'STATUS_NOT_FOUND',
        'Status not found.',
      );
    }
    if (status.requiresTask && !taskId) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        'TASK_REQUIRED_FOR_STATUS',
        `The status "${status.name}" requires a task.`,
      );
    }
    if (taskId) {
      await this.assertTaskExists(taskId);
    }
    return status;
  }

  private async assertTaskExists(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'TASK_NOT_FOUND',
        'Task not found.',
      );
    }
  }

  private async getDeveloperOrThrow(userId: string) {
    const developer = await this.prisma.developer.findUnique({
      where: { userId },
    });
    if (!developer) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        'NOT_A_DEVELOPER',
        'Only developer accounts can manage activities.',
      );
    }
    return developer;
  }

  private async getCurrentActivityOrThrow(
    developerId: string,
  ): Promise<DeveloperActivity> {
    const activity = await this.prisma.developerActivity.findFirst({
      where: { developerId, endedAt: null },
    });
    if (!activity) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'NO_ACTIVE_ACTIVITY',
        'You do not have an active activity. Start one first via POST /activities.',
      );
    }
    return activity;
  }

  private assertOwnsActivity(
    activity: DeveloperActivity,
    user: RequestUser,
  ): void {
    const isOwner = activity.userId === user.id;
    const isAdmin = user.roles.includes(UserRole.ADMIN);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException({
        code: 'UNAUTHORIZED_ACTIVITY_ACCESS',
        message: 'You can only manage your own activities.',
      });
    }
  }

  private assertFound<T>(activity: T | null): T {
    if (!activity) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'ACTIVITY_NOT_FOUND',
        'Activity not found.',
      );
    }
    return activity;
  }

  private diffSeconds(from: Date, to: Date): number {
    return Math.floor((to.getTime() - from.getTime()) / 1000);
  }

  private appendNote(description: string | null, note: string): string {
    return description ? `${description}\n\nNota final: ${note}` : note;
  }

  // Translates the DB-level guarantee (Prisma P2002 on the filtered unique index
  // from the Fase 2 migration) into the business error the spec requires (section 40).
  // This is deliberately the *only* thing standing between a race condition and a
  // silently-accepted second active activity — see the concurrency test.
  private translateActiveActivityConflict(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new AppException(
        HttpStatus.CONFLICT,
        'ACTIVE_ACTIVITY_EXISTS',
        'The developer already has an active activity.',
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
