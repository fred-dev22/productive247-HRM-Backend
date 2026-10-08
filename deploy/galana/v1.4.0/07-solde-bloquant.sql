-- Option par type de conge : bloquer la soumission quand le solde est
-- insuffisant (retour client du 08/10). Vrai par defaut pour tous les types :
-- c'est le comportement demande ; la decocher sur un type (ex. medical) lui
-- rend l'ancien comportement (la demande part, le validateur est averti).
-- Aucune donnee modifiee. Rejouable (la colonne n'est ajoutee qu'une fois).
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

IF COL_LENGTH('dbo.LeaveType', 'BlockIfInsufficientBalance') IS NULL
BEGIN
    ALTER TABLE [dbo].[LeaveType] ADD [BlockIfInsufficientBalance] BIT NOT NULL CONSTRAINT [LeaveType_BlockIfInsufficientBalance_df] DEFAULT 1;
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
GO
