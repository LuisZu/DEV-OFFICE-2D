import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OfficeController } from './office.controller';
import { OfficeService } from './office.service';
import { OfficeGateway } from './gateways/office.gateway';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OfficeController],
  providers: [OfficeService, OfficeGateway],
  exports: [OfficeService],
})
export class OfficeModule {}
