import { HttpStatus, Injectable } from '@nestjs/common';
import { Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryProjectsDto): Promise<PaginatedResult<Project>> {
    const { page, limit, isActive } = query;
    const where = isActive === undefined ? {} : { isActive };

    const [total, projects] = await this.prisma.$transaction([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      items: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<Project> {
    return this.assertFound(
      await this.prisma.project.findUnique({ where: { id } }),
    );
  }

  async create(dto: CreateProjectDto): Promise<Project> {
    const existing = await this.prisma.project.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PROJECT_CODE_ALREADY_EXISTS',
        `A project with code "${dto.code}" already exists.`,
      );
    }

    return this.prisma.project.create({ data: dto });
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    await this.findOne(id);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  // Soft delete: Task.projectId is a NoAction FK, so a hard delete would fail once
  // the project has tasks. Archiving (isActive = false) is the reversible equivalent.
  async archive(id: string): Promise<Project> {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private assertFound(project: Project | null): Project {
    if (!project) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'PROJECT_NOT_FOUND',
        'Project not found.',
      );
    }
    return project;
  }
}
