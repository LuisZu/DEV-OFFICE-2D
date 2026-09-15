import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { StartActivityDto } from './dto/start-activity.dto';
import { FinishActivityDto } from './dto/finish-activity.dto';
import { ChangeTaskDto } from './dto/change-task.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { QueryActivitiesDto } from './dto/query-activities.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  findAll(@Query() query: QueryActivitiesDto) {
    return this.activitiesService.findAll(query);
  }

  // Must be declared before ':id' so Express doesn't swallow it as an id param.
  @Get('current')
  findCurrent(@CurrentUser() user: RequestUser) {
    return this.activitiesService.findCurrent(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activitiesService.findOne(id);
  }

  @Post()
  start(@Body() dto: StartActivityDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.start(dto, user);
  }

  // Must be declared before ':id/finish' for the same reason as GET 'current'.
  @Post('current/change-task')
  @HttpCode(HttpStatus.OK)
  changeTask(@Body() dto: ChangeTaskDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.changeTask(dto, user);
  }

  @Post('current/change-status')
  @HttpCode(HttpStatus.OK)
  changeStatus(@Body() dto: ChangeStatusDto, @CurrentUser() user: RequestUser) {
    return this.activitiesService.changeStatus(dto, user);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  finish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinishActivityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.activitiesService.finish(id, dto, user);
  }
}
