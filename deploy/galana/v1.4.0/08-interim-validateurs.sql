-- Retour client du 04/11 : l'interimaire d'un validateur doit pouvoir valider a
-- tout moment (deplacement, reunion), pas seulement pendant un conge approuve du
-- titulaire. A executer UNE SEULE FOIS sur la base existante, avant de demarrer
-- le nouveau backend. Rejouable sans effet : chaque ajout est conditionnel. Une
-- seule transaction : tout ou rien.
--
-- Structure : un interimaire porte par la fiche du validateur direct
-- (Employee.ValidatorInterimId, vide par defaut). Il recoit les demandes en meme
-- temps que le validateur, a tout moment ; l'un ou l'autre peut decider.
--
-- ATTENTION : cote code, les interimaires deja saisis sur les membres de pool
-- (ApprovalPoolMember.InterimEmployeeId) recoivent desormais les demandes en meme
-- temps que le titulaire, au lieu de ne les recevoir que pendant un conge approuve
-- de celui-ci. Aucune colonne a ajouter pour cela.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

-- Interimaire du validateur direct
IF COL_LENGTH('dbo.Employee', 'ValidatorInterimId') IS NULL
BEGIN
    ALTER TABLE [dbo].[Employee] ADD [ValidatorInterimId] UNIQUEIDENTIFIER NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'Employee_ValidatorInterimId_fkey')
BEGIN
    ALTER TABLE [dbo].[Employee] ADD CONSTRAINT [Employee_ValidatorInterimId_fkey] FOREIGN KEY ([ValidatorInterimId]) REFERENCES [dbo].[Employee]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Employee_ValidatorInterimId_idx' AND object_id = OBJECT_ID('dbo.Employee'))
BEGIN
    EXEC(N'CREATE NONCLUSTERED INDEX [Employee_ValidatorInterimId_idx] ON [dbo].[Employee]([ValidatorInterimId]);');
END;

COMMIT TRAN;
PRINT N'Script 08 (interimaires de validateurs) applique.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
GO
