import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { OfficeService } from '../office.service';
import {
  OFFICE_EVENTS,
  OFFICE_ROOMS,
} from '../constants/office-events.constant';
import {
  DeveloperActivityFinishedPayload,
  DeveloperActivityStartedPayload,
  DeveloperStatusChangedPayload,
  DeveloperTaskChangedPayload,
  MeetingFinishedPayload,
  MeetingParticipantPayload,
  MeetingStartedPayload,
} from '../interfaces/office-event-payloads.interface';

interface SocketData {
  userId: string;
  developerId: string | null;
}

// Same allow-list as the REST API (main.ts reads the same CORS_ORIGIN via
// ConfigService) — read directly from process.env here since gateway options
// are evaluated at decoration time, before Nest's DI container exists.
@WebSocketGateway({
  namespace: '/office',
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class OfficeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('OfficeGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly officeService: OfficeService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(
        token,
        {
          secret: this.configService.get<string>('jwt.secret'),
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { developer: true },
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid or inactive user');
      }

      const data: SocketData = {
        userId: user.id,
        developerId: user.developer?.id ?? null,
      };
      client.data = data;

      await client.join(OFFICE_ROOMS.MAIN);

      if (data.developerId) {
        await client.join(OFFICE_ROOMS.developer(data.developerId));
        this.server
          .to(OFFICE_ROOMS.MAIN)
          .emit(OFFICE_EVENTS.DEVELOPER_CONNECTED, {
            developerId: data.developerId,
            at: new Date().toISOString(),
          });
      }
    } catch (error) {
      this.logger.warn(
        `Rejected socket connection: ${(error as Error).message}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as SocketData | undefined;
    if (data?.developerId) {
      this.server
        .to(OFFICE_ROOMS.MAIN)
        .emit(OFFICE_EVENTS.DEVELOPER_DISCONNECTED, {
          developerId: data.developerId,
          at: new Date().toISOString(),
        });
    }
  }

  // Reconnection (spec section 21/50): the client never assumes it knows the
  // correct state after a reconnect — it explicitly asks for a fresh snapshot
  // instead of relying on whatever events it may have missed while disconnected.
  @SubscribeMessage(OFFICE_EVENTS.SYNC_REQUEST)
  async handleSyncRequest(@ConnectedSocket() client: Socket) {
    const snapshot = await this.buildSnapshot();
    client.emit(OFFICE_EVENTS.SYNC_RESPONSE, snapshot);
  }

  @OnEvent(OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED)
  handleActivityStarted(payload: DeveloperActivityStartedPayload) {
    this.broadcast(OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED, payload);
  }

  @OnEvent(OFFICE_EVENTS.DEVELOPER_ACTIVITY_FINISHED)
  handleActivityFinished(payload: DeveloperActivityFinishedPayload) {
    this.broadcast(OFFICE_EVENTS.DEVELOPER_ACTIVITY_FINISHED, payload);
  }

  @OnEvent(OFFICE_EVENTS.DEVELOPER_STATUS_CHANGED)
  handleStatusChanged(payload: DeveloperStatusChangedPayload) {
    this.broadcast(OFFICE_EVENTS.DEVELOPER_STATUS_CHANGED, payload);
  }

  @OnEvent(OFFICE_EVENTS.DEVELOPER_TASK_CHANGED)
  handleTaskChanged(payload: DeveloperTaskChangedPayload) {
    this.broadcast(OFFICE_EVENTS.DEVELOPER_TASK_CHANGED, payload);
  }

  @OnEvent(OFFICE_EVENTS.MEETING_STARTED)
  handleMeetingStarted(payload: MeetingStartedPayload) {
    this.broadcast(OFFICE_EVENTS.MEETING_STARTED, payload);
  }

  @OnEvent(OFFICE_EVENTS.MEETING_FINISHED)
  handleMeetingFinished(payload: MeetingFinishedPayload) {
    this.broadcast(OFFICE_EVENTS.MEETING_FINISHED, payload);
  }

  @OnEvent(OFFICE_EVENTS.MEETING_PARTICIPANT_JOINED)
  handleMeetingParticipantJoined(payload: MeetingParticipantPayload) {
    this.broadcast(OFFICE_EVENTS.MEETING_PARTICIPANT_JOINED, payload);
  }

  @OnEvent(OFFICE_EVENTS.MEETING_PARTICIPANT_LEFT)
  handleMeetingParticipantLeft(payload: MeetingParticipantPayload) {
    this.broadcast(OFFICE_EVENTS.MEETING_PARTICIPANT_LEFT, payload);
  }

  private broadcast(event: string, payload: unknown): void {
    this.server.to(OFFICE_ROOMS.MAIN).emit(event, payload);
  }

  private async buildSnapshot() {
    const developers = await this.officeService.getDevelopersSnapshot();
    return { developers, serverTime: new Date().toISOString() };
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length);
    }

    throw new Error('Missing authentication token');
  }
}
