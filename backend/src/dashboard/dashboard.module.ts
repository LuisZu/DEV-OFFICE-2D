import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { OfficeModule } from '../office/office.module';

@Module({
  imports: [OfficeModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
