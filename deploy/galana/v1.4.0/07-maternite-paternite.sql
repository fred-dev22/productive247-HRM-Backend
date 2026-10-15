-- Retour client du 14/10 : soldes des conges de maternite et de paternite a 0
-- partout. Seuls les employes qui deposent un dossier sont credites, par la RH
-- (ecran "Ajuster un solde").
--
--  1) Structure : option par type "Generation automatique des soldes"
--     (LeaveType.AutoAccrual, vraie par defaut). Decochee sur maternite et
--     paternite : la generation (annuelle / mensuelle / nouvel employe) ne les
--     credite plus. Le solde reste un plafond : sans credit, la demande est
--     bloquee (a la difference d'un type illimite).
--  2) Donnees : pour chaque employe ayant un solde > 0 sur ces types, une ligne
--     d'historique "Consommation / Manuel" trace la remise a zero, puis le solde
--     passe a 0.
--
-- Types vises : ceux dont le nom contient "matern" ou "patern" (maternite,
-- paternite). Le bloc 0 les liste d'abord : verifier qu'il n'y en a pas d'autre.
-- Rejouable sans effet (rien a faire la deuxieme fois). Une seule transaction.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- 0) Types concernes (lecture seule, a controler avant d'executer le reste)
SELECT [Id], [Code], [Name], [DaysPerYear], [IsActive]
FROM [dbo].[LeaveType]
WHERE [Name] LIKE N'%matern%' OR [Name] LIKE N'%patern%';
GO

IF COL_LENGTH('dbo.LeaveType', 'AutoAccrual') IS NULL
BEGIN
    ALTER TABLE [dbo].[LeaveType] ADD [AutoAccrual] BIT NOT NULL CONSTRAINT [LeaveType_AutoAccrual_df] DEFAULT 1;
END;
GO

BEGIN TRY
BEGIN TRAN;

DECLARE @by UNIQUEIDENTIFIER = (SELECT TOP 1 [Id] FROM [dbo].[Employee] WHERE [IsSystem] = 1);
IF @by IS NULL THROW 50001, 'Compte administrateur systeme introuvable (Employee.IsSystem = 1).', 1;

DECLARE @types TABLE ([Id] UNIQUEIDENTIFIER PRIMARY KEY);
INSERT INTO @types ([Id])
SELECT [Id] FROM [dbo].[LeaveType]
WHERE [Name] LIKE N'%matern%' OR [Name] LIKE N'%patern%';

-- 1) Plus de credit automatique sur ces types
UPDATE lt SET lt.[AutoAccrual] = 0
FROM [dbo].[LeaveType] lt
JOIN @types t ON t.[Id] = lt.[Id]
WHERE lt.[AutoAccrual] <> 0;

-- 2) Trace de la remise a zero dans l'historique des soldes
INSERT INTO [dbo].[LeaveTransaction]
    ([Id], [EmployeeId], [LeaveTypeId], [Type], [Days], [StartDate], [EndDate], [LeaveRequestId], [Source], [CreatedBy], [CreatedAt])
SELECT NEWID(), b.[EmployeeId], b.[LeaveTypeId], N'Consumption', b.[Balance],
       CAST(GETDATE() AS DATE), CAST(GETDATE() AS DATE), NULL, N'Manual', @by, SYSDATETIME()
FROM [dbo].[EmployeeLeaveBalance] b
JOIN @types t ON t.[Id] = b.[LeaveTypeId]
WHERE b.[Balance] > 0;

-- 3) Soldes a 0
UPDATE b SET b.[Balance] = 0, b.[ModifiedAt] = SYSDATETIME()
FROM [dbo].[EmployeeLeaveBalance] b
JOIN @types t ON t.[Id] = b.[LeaveTypeId]
WHERE b.[Balance] <> 0;

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
