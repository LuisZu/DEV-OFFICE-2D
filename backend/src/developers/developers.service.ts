import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Developer, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { UserRole } from '../common/enums';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { QueryDevelopersDto } from './dto/query-developers.dto';
import { DeveloperEntity } from './entities/developer.entity';

const SALT_ROUNDS = 10;

type DeveloperWithUser = Developer & { user: User };

@Injectable()
export class DevelopersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: QueryDevelopersDto,
  ): Promise<PaginatedResult<DeveloperEntity>> {
    const { page, limit, isActive } = query;
    const where = isActive === undefined ? {} : { user: { isActive } };

    const [total, developers] = await this.prisma.$transaction([
      this.prisma.developer.count({ where }),
      this.prisma.developer.findMany({
        where,
        include: { user: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      items: developers.map((developer) => this.toEntity(developer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<DeveloperEntity> {
    const developer = await this.prisma.developer.findUnique({
      where: { id },
      include: { user: true },
    });
    return this.toEntity(this.assertFound(developer));
  }

  async create(dto: CreateDeveloperDto): Promise<DeveloperEntity> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'EMAIL_ALREADY_EXISTS',
        'A user with this email already exists.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const developer = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatarUrl: dto.avatarUrl,
        },
      });

      await tx.userRoleAssignment.create({
        data: { userId: user.id, role: UserRole.DEVELOPER },
      });

      const created = await tx.developer.create({ data: { userId: user.id } });

      return { ...created, user };
    });

    return this.toEntity(developer);
  }

  async update(id: string, dto: UpdateDeveloperDto): Promise<DeveloperEntity> {
    const developer = this.assertFound(
      await this.prisma.developer.findUnique({ where: { id } }),
    );

    const user = await this.prisma.user.update({
      where: { id: developer.userId },
      data: dto,
    });

    return this.toEntity({ ...developer, user });
  }

  // Soft delete: several tables (DeveloperActivity, MeetingParticipant, ...) reference
  // a developer with NoAction/Cascade FKs that make a hard DELETE either impossible
  // once history exists, or destructive to that history. Deactivating the underlying
  // User is the reversible, audit-preserving equivalent, consistent with the isActive
  // flags already modeled on User/Project/DeveloperStatus.
  async deactivate(id: string): Promise<DeveloperEntity> {
    const developer = this.assertFound(
      await this.prisma.developer.findUnique({ where: { id } }),
    );

    const user = await this.prisma.user.update({
      where: { id: developer.userId },
      data: { isActive: false },
    });

    return this.toEntity({ ...developer, user });
  }

  private assertFound<T>(developer: T | null): T {
    if (!developer) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        'DEVELOPER_NOT_FOUND',
        'Developer not found.',
      );
    }
    return developer;
  }

  private toEntity(developer: DeveloperWithUser): DeveloperEntity {
    return {
      id: developer.id,
      userId: developer.userId,
      email: developer.user.email,
      firstName: developer.user.firstName,
      lastName: developer.user.lastName,
      avatarUrl: developer.user.avatarUrl,
      isActive: developer.user.isActive,
      createdAt: developer.createdAt,
      updatedAt: developer.updatedAt,
    };
  }
}
