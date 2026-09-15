import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficeService } from '../office/office.service';
import { QueryDashboardRangeDto } from './dto/query-dashboard-range.dto';

const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officeService: OfficeService,
  ) {}

  async getSummary() {
    const [totalDevelopers, activeCounts, statuses] = await Promise.all([
      this.prisma.developer.count({ where: { user: { isActive: true } } }),
      this.prisma.developerActivity.groupBy({
        by: ['statusId'],
        where: { endedAt: null },
        _count: { _all: true },
      }),
      this.prisma.developerStatus.findMany(),
    ]);

    const statusMap = new Map(statuses.map((status) => [status.id, status]));
    const byStatus = activeCounts.map((entry) => {
      const status = statusMap.get(entry.statusId);
      return {
        id: entry.statusId,
        code: status?.code ?? 'UNKNOWN',
        name: status?.name ?? 'Desconocido',
        icon: status?.icon ?? null,
        color: status?.color ?? null,
        count: entry._count._all,
      };
    });

    const withActivity = activeCounts.reduce(
      (sum, entry) => sum + entry._count._all,
      0,
    );

    return {
      totalDevelopers,
      byStatus,
      withoutActivity: Math.max(0, totalDevelopers - withActivity),
    };
  }

  async getActiveActivities() {
    const developers = await this.officeService.getDevelopersSnapshot();
    return developers.filter((developer) => developer.currentActivity !== null);
  }

  async getActivityDistribution(query: QueryDashboardRangeDto) {
    const { from, to } = this.resolveRange(query);

    const [grouped, statuses] = await Promise.all([
      this.prisma.developerActivity.groupBy({
        by: ['statusId'],
        where: { startedAt: { gte: from, lte: to }, endedAt: { not: null } },
        _sum: { durationSeconds: true },
        _count: { _all: true },
      }),
      this.prisma.developerStatus.findMany(),
    ]);

    const statusMap = new Map(statuses.map((status) => [status.id, status]));

    return grouped.map((entry) => {
      const status = statusMap.get(entry.statusId);
      return {
        status: {
          id: entry.statusId,
          code: status?.code ?? 'UNKNOWN',
          name: status?.name ?? 'Desconocido',
          color: status?.color ?? null,
        },
        totalSeconds: entry._sum.durationSeconds ?? 0,
        count: entry._count._all,
      };
    });
  }

  async getProductivity(query: QueryDashboardRangeDto) {
    const { from, to } = this.resolveRange(query);

    const activities = await this.prisma.developerActivity.findMany({
      where: { startedAt: { gte: from, lte: to }, endedAt: { not: null } },
      select: {
        developerId: true,
        durationSeconds: true,
        status: { select: { isProductive: true } },
        developer: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const byDeveloper = new Map<
      string,
      {
        firstName: string;
        lastName: string;
        productiveSeconds: number;
        totalSeconds: number;
      }
    >();

    for (const activity of activities) {
      const duration = activity.durationSeconds ?? 0;
      const entry = byDeveloper.get(activity.developerId) ?? {
        firstName: activity.developer.user.firstName,
        lastName: activity.developer.user.lastName,
        productiveSeconds: 0,
        totalSeconds: 0,
      };

      entry.totalSeconds += duration;
      if (activity.status.isProductive) {
        entry.productiveSeconds += duration;
      }

      byDeveloper.set(activity.developerId, entry);
    }

    return Array.from(byDeveloper.entries()).map(([developerId, entry]) => ({
      developerId,
      firstName: entry.firstName,
      lastName: entry.lastName,
      productiveSeconds: entry.productiveSeconds,
      totalSeconds: entry.totalSeconds,
      productivityRate:
        entry.totalSeconds > 0
          ? entry.productiveSeconds / entry.totalSeconds
          : 0,
    }));
  }

  private resolveRange(query: QueryDashboardRangeDto): {
    from: Date;
    to: Date;
  } {
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    const from = query.dateFrom
      ? new Date(query.dateFrom)
      : new Date(to.getTime() - DEFAULT_RANGE_MS);
    return { from, to };
  }
}
