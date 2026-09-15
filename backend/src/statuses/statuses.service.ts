import { HttpStatus, Injectable } from '@nestjs/common';
import { DeveloperStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class StatusesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<DeveloperStatus[]> {
    return this.prisma.developerStatus.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string): Promise<DeveloperStatus> {
    return this.assertFound(
      await this.prisma.developerStatus.findUnique({ where: { id } }),
    );
  }

  async create(dto: CreateStatusDto): Promise<DeveloperStatus> {
    const existing = await this.prisma.developerStatus.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'STATUS_CODE_ALREADY_EXISTS',
        `A status with code "${dto.code}" already exists.`,
      );
    }
    return this.prisma.developerStatus.create({ data: dto });
  }

  async update(id: string, dto: UpdateStatusDto): Promise<DeveloperStatus> {
    await this.findOne(id);
    return this.prisma.developerStatus.update({ where: { id }, data: dto });
  }

  // Soft delete: DeveloperActivity.statusId is a NoAction FK, so a status that has
  // ever been used in an activity can't be hard-deleted. Deactivating keeps history
  // intact while hiding it from future selection (the office UI should filter to
  // isActive statuses when offering choices).
  async deactivate(id: string): Promise<DeveloperStatus> {
    await this.findOne(id);
    return this.prisma.developerStatus.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private assertFound(status: DeveloperStatus | null): DeveloperStatus {
    if (!status) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'STATUS_NOT_FOUND',
        'Status not found.',
      );
    }
    return status;
  }
}
