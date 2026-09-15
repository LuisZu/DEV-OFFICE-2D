import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { QueryDashboardRangeDto } from './dto/query-dashboard-range.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('active-activities')
  getActiveActivities() {
    return this.dashboardService.getActiveActivities();
  }

  @Get('activity-distribution')
  getActivityDistribution(@Query() query: QueryDashboardRangeDto) {
    return this.dashboardService.getActivityDistribution(query);
  }

  // Per-developer productivity is attributable, sensitive performance data —
  // unlike the aggregate endpoints above, it's restricted to ADMIN/MANAGER.
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Get('productivity')
  getProductivity(@Query() query: QueryDashboardRangeDto) {
    return this.dashboardService.getProductivity(query);
  }
}
