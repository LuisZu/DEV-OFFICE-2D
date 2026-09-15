import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { DeveloperActivitiesController } from './developer-activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  controllers: [ActivitiesController, DeveloperActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
