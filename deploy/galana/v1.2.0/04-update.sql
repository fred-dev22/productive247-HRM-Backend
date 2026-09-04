-- Requis par la creation de l index filtre plus bas : ces options sont
-- prises en compte a l analyse du lot, d ou le GO qui suit.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Holiday] ADD [AppliesToExpatriate] BIT,
[AppliesToGender] NVARCHAR(5);

-- AlterTable
ALTER TABLE [dbo].[LeaveType] ADD [AppliesToExpatriate] BIT,
[AppliesToGender] NVARCHAR(5),
[OrganizationUnitId] UNIQUEIDENTIFIER;

-- AlterTable
ALTER TABLE [dbo].[LeaveTransaction] ADD [Source] NVARCHAR(20) NOT NULL CONSTRAINT [LeaveTransaction_Source_df] DEFAULT 'System';

-- CreateIndex
CREATE NONCLUSTERED INDEX [LeaveType_OrganizationUnitId_idx] ON [dbo].[LeaveType]([OrganizationUnitId]);

-- AddForeignKey
ALTER TABLE [dbo].[LeaveType] ADD CONSTRAINT [LeaveType_OrganizationUnitId_fkey] FOREIGN KEY ([OrganizationUnitId]) REFERENCES [dbo].[OrganizationUnit]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
