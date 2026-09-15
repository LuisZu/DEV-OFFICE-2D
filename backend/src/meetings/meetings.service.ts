import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { OFFICE_EVENTS } from '../office/constants/office-events.constant';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { QueryMeetingsDto } from './dto/query-meetings.dto';

const meetingInclude = {
  participants: {
    include: {
      developer: {
        select: {
          id: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
    },
  },
} satisfies Prisma.MeetingInclude;

type MeetingWithParticipants = Prisma.MeetingGetPayload<{
  include: typeof meetingInclude;
}>;

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    query: QueryMeetingsDto,
  ): Promise<PaginatedResult<MeetingWithParticipants>> {
    const { page, limit } = query;

    const [total, meetings] = await this.prisma.$transaction([
      this.prisma.meeting.count(),
      this.prisma.meeting.findMany({
        include: meetingInclude,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      items: meetings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<MeetingWithParticipants> {
    return this.assertFound(
      await this.prisma.meeting.findUnique({
        where: { id },
        include: meetingInclude,
      }),
    );
  }

  async create(dto: CreateMeetingDto): Promise<MeetingWithParticipants> {
    return this.prisma.meeting.create({
      data: { title: dto.title, description: dto.description },
      include: meetingInclude,
    });
  }

  async start(id: string): Promise<MeetingWithParticipants> {
    const meeting = await this.findOne(id);
    if (meeting.startedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'MEETING_ALREADY_STARTED',
        'This meeting has already started.',
      );
    }

    const started = await this.prisma.meeting.update({
      where: { id },
      data: { startedAt: new Date() },
      include: meetingInclude,
    });

    this.eventEmitter.emit(OFFICE_EVENTS.MEETING_STARTED, {
      meetingId: started.id,
      title: started.title,
      startedAt: started.startedAt!.toISOString(),
      participantIds: started.participants.map((p) => p.developer.id),
    });

    return started;
  }

  async finish(id: string): Promise<MeetingWithParticipants> {
    const meeting = await this.findOne(id);
    if (!meeting.startedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'MEETING_NOT_STARTED',
        'This meeting has not started yet.',
      );
    }
    if (meeting.endedAt) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'MEETING_ALREADY_FINISHED',
        'This meeting has already finished.',
      );
    }

    const finished = await this.prisma.meeting.update({
      where: { id },
      data: { endedAt: new Date() },
      include: meetingInclude,
    });

    this.eventEmitter.emit(OFFICE_EVENTS.MEETING_FINISHED, {
      meetingId: finished.id,
      title: finished.title,
      endedAt: finished.endedAt!.toISOString(),
      participantIds: finished.participants.map((p) => p.developer.id),
    });

    return finished;
  }

  async addParticipant(
    meetingId: string,
    dto: AddParticipantDto,
  ): Promise<MeetingWithParticipants> {
    await this.findOne(meetingId);

    const developer = await this.prisma.developer.findUnique({
      where: { id: dto.developerId },
    });
    if (!developer) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'DEVELOPER_NOT_FOUND',
        'Developer not found.',
      );
    }

    const existing = await this.prisma.meetingParticipant.findUnique({
      where: {
        meetingId_developerId: { meetingId, developerId: dto.developerId },
      },
    });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PARTICIPANT_ALREADY_ADDED',
        'This developer is already a participant of the meeting.',
      );
    }

    await this.prisma.meetingParticipant.create({
      data: { meetingId, developerId: dto.developerId },
    });

    this.eventEmitter.emit(OFFICE_EVENTS.MEETING_PARTICIPANT_JOINED, {
      meetingId,
      developerId: dto.developerId,
    });

    return this.findOne(meetingId);
  }

  async removeParticipant(
    meetingId: string,
    developerId: string,
  ): Promise<MeetingWithParticipants> {
    await this.findOne(meetingId);

    const existing = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_developerId: { meetingId, developerId } },
    });
    if (!existing) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'PARTICIPANT_NOT_FOUND',
        'This developer is not a participant.',
      );
    }

    await this.prisma.meetingParticipant.delete({ where: { id: existing.id } });

    this.eventEmitter.emit(OFFICE_EVENTS.MEETING_PARTICIPANT_LEFT, {
      meetingId,
      developerId,
    });

    return this.findOne(meetingId);
  }

  private assertFound(
    meeting: MeetingWithParticipants | null,
  ): MeetingWithParticipants {
    if (!meeting) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'MEETING_NOT_FOUND',
        'Meeting not found.',
      );
    }
    return meeting;
  }
}
