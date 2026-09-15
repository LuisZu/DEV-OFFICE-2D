import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { OFFICE_EVENTS } from './constants/office-events.constant';
import { UpdateOfficePositionDto } from './dto/update-office-position.dto';

export const OFFICE_AREAS = [
  'desks',
  'coffee',
  'meeting',
  'lunch',
  'break',
] as const;

const developerSnapshotInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
      isActive: true,
    },
  },
  officePosition: true,
  activities: {
    where: { endedAt: null },
    take: 1,
    include: {
      status: {
        select: { id: true, code: true, name: true, icon: true, color: true },
      },
      task: { select: { id: true, code: true, title: true } },
    },
  },
} as const;

@Injectable()
export class OfficeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getDevelopersSnapshot() {
    const developers = await this.prisma.developer.findMany({
      include: developerSnapshotInclude,
      orderBy: { createdAt: 'asc' },
    });

    return developers.map((developer) => ({
      id: developer.id,
      firstName: developer.user.firstName,
      lastName: developer.user.lastName,
      email: developer.user.email,
      avatarUrl: developer.user.avatarUrl,
      isActive: developer.user.isActive,
      position: developer.officePosition
        ? {
            x: developer.officePosition.x,
            y: developer.officePosition.y,
            width: developer.officePosition.width,
            height: developer.officePosition.height,
            rotation: developer.officePosition.rotation,
            area: developer.officePosition.area,
          }
        : null,
      currentActivity: developer.activities[0]
        ? {
            id: developer.activities[0].id,
            status: developer.activities[0].status,
            task: developer.activities[0].task,
            startedAt: developer.activities[0].startedAt.toISOString(),
          }
        : null,
    }));
  }

  async getOfficeState() {
    const developers = await this.getDevelopersSnapshot();
    return { areas: OFFICE_AREAS, developers };
  }

  async updatePosition(developerId: string, dto: UpdateOfficePositionDto) {
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

    const position = await this.prisma.officePosition.upsert({
      where: { developerId },
      update: { x: dto.x, y: dto.y, area: dto.area },
      create: { developerId, x: dto.x, y: dto.y, area: dto.area },
    });

    this.eventEmitter.emit(OFFICE_EVENTS.OFFICE_DEVELOPER_POSITION_CHANGED, {
      developerId,
      x: position.x,
      y: position.y,
      area: position.area,
    });

    return position;
  }
}
