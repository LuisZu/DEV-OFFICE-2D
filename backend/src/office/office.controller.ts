import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OfficeService } from './office.service';
import { UpdateOfficePositionDto } from './dto/update-office-position.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('office')
@ApiBearerAuth()
@Controller('office')
export class OfficeController {
  constructor(private readonly officeService: OfficeService) {}

  @Get()
  getOfficeState() {
    return this.officeService.getOfficeState();
  }

  @Get('developers')
  getDevelopers() {
    return this.officeService.getDevelopersSnapshot();
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch('developers/:developerId/position')
  updatePosition(
    @Param('developerId', ParseUUIDPipe) developerId: string,
    @Body() dto: UpdateOfficePositionDto,
  ) {
    return this.officeService.updatePosition(developerId, dto);
  }
}
