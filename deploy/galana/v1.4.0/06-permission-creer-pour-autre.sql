-- Nouvelles permissions : creer une demande (conge, mission, note de frais)
-- POUR UN AUTRE employe. Reservees par defaut aux categories Admin RH et
-- Directeur RH ; les autres comptes ne voient plus l'option et le serveur la
-- refuse. A executer UNE SEULE FOIS (rejouable sans effet : chaque ajout est
-- conditionnel). Aucune structure de table n'est modifiee.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

-- 1) Catalogue des permissions
INSERT INTO [dbo].[Permission] ([Id], [Code], [Label], [Module])
SELECT NEWID(), v.[Code], v.[Label], v.[Module]
FROM (VALUES
    (N'CONGE_CREER_POUR_AUTRE',   N'Créer une demande de congé pour un autre employé', N'Congés'),
    (N'MISSION_CREER_POUR_AUTRE', N'Créer un ordre de mission pour un autre employé',  N'Missions'),
    (N'FRAIS_CREER_POUR_AUTRE',   N'Créer une note de frais pour un autre employé',    N'Notes de frais')
) AS v([Code], [Label], [Module])
WHERE NOT EXISTS (SELECT 1 FROM [dbo].[Permission] p WHERE p.[Code] = v.[Code]);

-- Auteur technique des lignes ajoutees : le compte administrateur systeme.
DECLARE @by UNIQUEIDENTIFIER = (SELECT TOP 1 [Id] FROM [dbo].[Employee] WHERE [IsSystem] = 1);
IF @by IS NULL THROW 50001, 'Compte administrateur systeme introuvable (Employee.IsSystem = 1).', 1;

-- 2) Modele des categories Admin RH et Directeur RH
INSERT INTO [dbo].[CategoryPermission] ([Id], [EmployeeCategoryId], [PermissionId], [CreatedBy])
SELECT NEWID(), c.[Id], p.[Id], @by
FROM [dbo].[EmployeeCategory] c
CROSS JOIN [dbo].[Permission] p
WHERE c.[Code] IN (N'ADMIN-RH', N'DIRECTEUR-RH')
  AND p.[Code] IN (N'CONGE_CREER_POUR_AUTRE', N'MISSION_CREER_POUR_AUTRE', N'FRAIS_CREER_POUR_AUTRE')
  AND NOT EXISTS (SELECT 1 FROM [dbo].[CategoryPermission] cp WHERE cp.[EmployeeCategoryId] = c.[Id] AND cp.[PermissionId] = p.[Id]);

-- 3) Comptes DEJA crees dans ces categories (leurs permissions sont une copie
--    faite a la creation du compte : elles ne suivent pas le modele).
INSERT INTO [dbo].[UserPermission] ([Id], [UserId], [PermissionId], [CreatedBy])
SELECT NEWID(), u.[Id], p.[Id], @by
FROM [dbo].[User] u
JOIN [dbo].[EmployeeCategory] c ON c.[Id] = u.[EmployeeCategoryId] AND c.[Code] IN (N'ADMIN-RH', N'DIRECTEUR-RH')
CROSS JOIN [dbo].[Permission] p
WHERE p.[Code] IN (N'CONGE_CREER_POUR_AUTRE', N'MISSION_CREER_POUR_AUTRE', N'FRAIS_CREER_POUR_AUTRE')
  AND NOT EXISTS (SELECT 1 FROM [dbo].[UserPermission] up WHERE up.[UserId] = u.[Id] AND up.[PermissionId] = p.[Id]);

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
