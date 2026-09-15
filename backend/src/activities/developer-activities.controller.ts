import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { QueryActivitiesDto } from './dto/query-activities.dto';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('developers/:developerId/activities')
export class DeveloperActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findByDeveloper(
    @Param('developerId', ParseUUIDPipe) developerId: string,
    @Query() query: QueryActivitiesDto,
  ) {
    return this.activitiesService.findByDeveloper(developerId, query);
  }
}
