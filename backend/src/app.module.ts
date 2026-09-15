import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ConditionalThrottlerGuard } from './common/guards/conditional-throttler.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DevelopersModule } from './developers/developers.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { StatusesModule } from './statuses/statuses.module';
import { ActivitiesModule } from './activities/activities.module';
import { OfficeModule } from './office/office.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MeetingsModule } from './meetings/meetings.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { loggerOptions } from './config/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    LoggerModule.forRoot(loggerOptions),
    // Default: 100 requests / 60s per IP across the whole API. Auth endpoints
    // override this with a tighter limit (see AuthController) since they're
    // the classic brute-force target.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    DevelopersModule,
    ProjectsModule,
    TasksModule,
    StatusesModule,
    ActivitiesModule,
    OfficeModule,
    DashboardModule,
    MeetingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ConditionalThrottlerGuard },
  ],
})
export class AppModule {}
