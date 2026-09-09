-- Requis par la creation de l index filtre plus bas : ces options sont
-- prises en compte a l analyse du lot, d ou le GO qui suit.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[OrganizationUnit] ADD [LeaveApprovalMode] NVARCHAR(20) NOT NULL CONSTRAINT [OrganizationUnit_LeaveApprovalMode_df] DEFAULT 'Pool';

-- AlterTable
ALTER TABLE [dbo].[Employee] ADD [DirectValidatorId] UNIQUEIDENTIFIER;

-- AlterTable
ALTER TABLE [dbo].[ApprovalDecision] ALTER COLUMN [ApprovalPoolMemberId] UNIQUEIDENTIFIER NULL;
ALTER TABLE [dbo].[ApprovalDecision] ADD [DirectValidatorEmployeeId] UNIQUEIDENTIFIER;

-- AlterTable
ALTER TABLE [dbo].[LeaveType] ADD [CountCalendarDays] BIT NOT NULL CONSTRAINT [LeaveType_CountCalendarDays_df] DEFAULT 0;

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employee_DirectValidatorId_idx] ON [dbo].[Employee]([DirectValidatorId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ApprovalDecision_DirectValidatorEmployeeId_idx] ON [dbo].[ApprovalDecision]([DirectValidatorEmployeeId]);

-- AddForeignKey
ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_DirectValidatorId_fkey] FOREIGN KEY ([DirectValidatorId]) REFERENCES [dbo].[Employee]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ApprovalDecision] ADD CONSTRAINT [ApprovalDecision_DirectValidatorEmployeeId_fkey] FOREIGN KEY ([DirectValidatorEmployeeId]) REFERENCES [dbo].[Employee]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
