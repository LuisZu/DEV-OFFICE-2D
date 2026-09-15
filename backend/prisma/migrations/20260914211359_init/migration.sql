BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(36) NOT NULL,
    [email] NVARCHAR(255) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [firstName] NVARCHAR(100) NOT NULL,
    [lastName] NVARCHAR(100) NOT NULL,
    [avatarUrl] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[UserRoleAssignment] (
    [id] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [role] NVARCHAR(20) NOT NULL,
    CONSTRAINT [UserRoleAssignment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserRoleAssignment_userId_role_key] UNIQUE NONCLUSTERED ([userId],[role])
);

-- CreateTable
CREATE TABLE [dbo].[Developer] (
    [id] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Developer_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Developer_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Developer_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[Project] (
    [id] NVARCHAR(36) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [code] NVARCHAR(50) NOT NULL,
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [Project_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Project_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Project_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Project_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Task] (
    [id] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(50) NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [description] NVARCHAR(2000),
    [projectId] NVARCHAR(36) NOT NULL,
    [assignedToId] NVARCHAR(36),
    [createdById] NVARCHAR(36) NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT [Task_status_df] DEFAULT 'TODO',
    [priority] NVARCHAR(20) NOT NULL CONSTRAINT [Task_priority_df] DEFAULT 'MEDIUM',
    [dueDate] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Task_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Task_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Task_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[DeveloperStatus] (
    [id] NVARCHAR(36) NOT NULL,
    [code] NVARCHAR(50) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [description] NVARCHAR(500),
    [icon] NVARCHAR(20),
    [color] NVARCHAR(20),
    [isProductive] BIT NOT NULL CONSTRAINT [DeveloperStatus_isProductive_df] DEFAULT 0,
    [requiresTask] BIT NOT NULL CONSTRAINT [DeveloperStatus_requiresTask_df] DEFAULT 0,
    [isActive] BIT NOT NULL CONSTRAINT [DeveloperStatus_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeveloperStatus_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DeveloperStatus_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DeveloperStatus_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[DeveloperActivity] (
    [id] NVARCHAR(36) NOT NULL,
    [developerId] NVARCHAR(36) NOT NULL,
    [userId] NVARCHAR(36) NOT NULL,
    [statusId] NVARCHAR(36) NOT NULL,
    [taskId] NVARCHAR(36),
    [description] NVARCHAR(1000),
    [startedAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2,
    [durationSeconds] INT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DeveloperActivity_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [DeveloperActivity_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Meeting] (
    [id] NVARCHAR(36) NOT NULL,
    [title] NVARCHAR(300) NOT NULL,
    [description] NVARCHAR(1000),
    [startedAt] DATETIME2 NOT NULL,
    [endedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Meeting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Meeting_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[MeetingParticipant] (
    [id] NVARCHAR(36) NOT NULL,
    [meetingId] NVARCHAR(36) NOT NULL,
    [developerId] NVARCHAR(36) NOT NULL,
    CONSTRAINT [MeetingParticipant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [MeetingParticipant_meetingId_developerId_key] UNIQUE NONCLUSTERED ([meetingId],[developerId])
);

-- CreateTable
CREATE TABLE [dbo].[OfficePosition] (
    [id] NVARCHAR(36) NOT NULL,
    [developerId] NVARCHAR(36) NOT NULL,
    [x] FLOAT(53) NOT NULL,
    [y] FLOAT(53) NOT NULL,
    [width] FLOAT(53) NOT NULL CONSTRAINT [OfficePosition_width_df] DEFAULT 64,
    [height] FLOAT(53) NOT NULL CONSTRAINT [OfficePosition_height_df] DEFAULT 64,
    [rotation] FLOAT(53) NOT NULL CONSTRAINT [OfficePosition_rotation_df] DEFAULT 0,
    [area] NVARCHAR(50),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OfficePosition_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OfficePosition_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [OfficePosition_developerId_key] UNIQUE NONCLUSTERED ([developerId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_email_idx] ON [dbo].[User]([email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_projectId_idx] ON [dbo].[Task]([projectId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_assignedToId_idx] ON [dbo].[Task]([assignedToId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Task_status_idx] ON [dbo].[Task]([status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeveloperActivity_developerId_endedAt_idx] ON [dbo].[DeveloperActivity]([developerId], [endedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeveloperActivity_startedAt_idx] ON [dbo].[DeveloperActivity]([startedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DeveloperActivity_taskId_idx] ON [dbo].[DeveloperActivity]([taskId]);

-- AddForeignKey
ALTER TABLE [dbo].[UserRoleAssignment] ADD CONSTRAINT [UserRoleAssignment_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Developer] ADD CONSTRAINT [Developer_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Task] ADD CONSTRAINT [Task_projectId_fkey] FOREIGN KEY ([projectId]) REFERENCES [dbo].[Project]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Task] ADD CONSTRAINT [Task_assignedToId_fkey] FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[Developer]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Task] ADD CONSTRAINT [Task_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeveloperActivity] ADD CONSTRAINT [DeveloperActivity_developerId_fkey] FOREIGN KEY ([developerId]) REFERENCES [dbo].[Developer]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeveloperActivity] ADD CONSTRAINT [DeveloperActivity_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeveloperActivity] ADD CONSTRAINT [DeveloperActivity_statusId_fkey] FOREIGN KEY ([statusId]) REFERENCES [dbo].[DeveloperStatus]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DeveloperActivity] ADD CONSTRAINT [DeveloperActivity_taskId_fkey] FOREIGN KEY ([taskId]) REFERENCES [dbo].[Task]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MeetingParticipant] ADD CONSTRAINT [MeetingParticipant_meetingId_fkey] FOREIGN KEY ([meetingId]) REFERENCES [dbo].[Meeting]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[MeetingParticipant] ADD CONSTRAINT [MeetingParticipant_developerId_fkey] FOREIGN KEY ([developerId]) REFERENCES [dbo].[Developer]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OfficePosition] ADD CONSTRAINT [OfficePosition_developerId_fkey] FOREIGN KEY ([developerId]) REFERENCES [dbo].[Developer]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- Concurrency guarantee (spec section 11): a developer can only have one active
-- (endedAt IS NULL) activity at a time. This is a SQL Server filtered index and
-- cannot be expressed in schema.prisma, so it is added by hand in this migration.
-- The application layer (ActivitiesService) still checks for an active activity
-- before inserting, but this index is the actual source of truth: concurrent
-- inserts will race on it and the loser gets a unique-constraint violation
-- (translated to 409 ACTIVE_ACTIVITY_EXISTS by the GlobalExceptionFilter).
CREATE UNIQUE NONCLUSTERED INDEX [DeveloperActivity_one_active_per_developer]
ON [dbo].[DeveloperActivity]([developerId])
WHERE [endedAt] IS NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
