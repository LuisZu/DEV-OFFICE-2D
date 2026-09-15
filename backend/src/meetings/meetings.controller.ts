import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { QueryMeetingsDto } from './dto/query-meetings.dto';

@ApiTags('meetings')
@ApiBearerAuth()
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  findAll(@Query() query: QueryMeetingsDto) {
    return this.meetingsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMeetingDto) {
    return this.meetingsService.create(dto);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.start(id);
  }

  @Post(':id/finish')
  @HttpCode(HttpStatus.OK)
  finish(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetingsService.finish(id);
  }

  @Post(':id/participants')
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipantDto,
  ) {
    return this.meetingsService.addParticipant(id, dto);
  }

  @Delete(':id/participants/:developerId')
  @HttpCode(HttpStatus.OK)
  removeParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('developerId', ParseUUIDPipe) developerId: string,
  ) {
    return this.meetingsService.removeParticipant(id, developerId);
  }
}
