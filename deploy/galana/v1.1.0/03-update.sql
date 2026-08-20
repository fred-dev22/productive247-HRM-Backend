-- Requis par la creation de l index filtre plus bas : ces options sont
-- prises en compte a l analyse du lot, d ou le GO qui suit.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[LeaveTransaction] ADD [Source] NVARCHAR(20) NOT NULL CONSTRAINT [LeaveTransaction_Source_df] DEFAULT 'System';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
