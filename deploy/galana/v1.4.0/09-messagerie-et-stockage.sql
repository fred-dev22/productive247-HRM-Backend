-- Configuration de l'application (messagerie ET stockage des fichiers), dans
-- l'espace Parametres de l'application (icone engrenage de la barre noire). A
-- executer UNE SEULE FOIS sur la base existante, avant de demarrer le nouveau
-- backend. Rejouable sans effet : chaque ajout est conditionnel. Chaque partie est
-- une transaction.
--
-- Partie 1 : table MailSettings (envoi d'emails : Microsoft Graph OU SMTP).
-- Partie 2 : table StorageSettings (stockage des fichiers : dossier du serveur OU
--            SharePoint) et colonne Attachment.StorageProvider. Les fichiers deja
--            deposes sur SharePoint restent lisibles (StorageProvider vide = SharePoint).
-- Tous les identifiants et secrets sont chiffres par le backend.
--
-- Acces : reserve au compte administrateur de lancement (l'employe d'amorcage,
-- Employee.IsSystem). Ce n'est PAS une permission : rien a accorder, et aucun autre
-- compte ne peut y acceder.
--
-- ATTENTION : les variables GRAPH_MAIL_TENANT_ID / CLIENT_ID / CLIENT_SECRET /
-- SENDER du .env ne sont PLUS lues. Apres la mise a jour, aucun email ne part tant
-- que l'administrateur n'a pas saisi la configuration dans Parametres > Messagerie
-- (une bande d'alerte l'indique a tout le monde). Reprendre les valeurs de l'ancien
-- .env avant de les retirer.
--
-- ATTENTION : les variables GRAPH_SHAREPOINT_* du .env ne sont PLUS lues non plus.
-- Aucun fichier (justificatif) ne peut etre envoye tant que l'administrateur n'a pas
-- choisi un dossier du serveur ou saisi SharePoint dans Parametres > Stockage (la
-- meme bande d'alerte l'indique). Pour continuer avec SharePoint, ressaisir les
-- valeurs de l'ancien .env dans cet ecran avant de les retirer.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

IF OBJECT_ID(N'dbo.MailSettings', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[MailSettings] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [MailSettings_Id_df] DEFAULT NEWID(),
        [Provider] NVARCHAR(10) NOT NULL,
        [Sender] NVARCHAR(200) NOT NULL,
        [GraphTenantIdEnc] NVARCHAR(1000) NULL,
        [GraphClientIdEnc] NVARCHAR(1000) NULL,
        [GraphClientSecretEnc] NVARCHAR(1000) NULL,
        [SmtpHost] NVARCHAR(200) NULL,
        [SmtpPort] INT NULL,
        [SmtpSecure] BIT NOT NULL CONSTRAINT [MailSettings_SmtpSecure_df] DEFAULT 0,
        [SmtpUserEnc] NVARCHAR(1000) NULL,
        [SmtpPasswordEnc] NVARCHAR(1000) NULL,
        [ModifiedBy] UNIQUEIDENTIFIER NULL,
        [ModifiedAt] DATETIME2 NULL,
        CONSTRAINT [MailSettings_pkey] PRIMARY KEY CLUSTERED ([Id])
    );
END;

COMMIT TRAN;
PRINT N'Script 09, partie 1 (configuration de la messagerie) applique.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
GO

-- ============================================================================
-- Partie 2 : stockage des fichiers
-- ============================================================================
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
BEGIN TRY

BEGIN TRAN;

IF OBJECT_ID(N'dbo.StorageSettings', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[StorageSettings] (
        [Id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [StorageSettings_Id_df] DEFAULT NEWID(),
        [Provider] NVARCHAR(10) NOT NULL,
        [LocalPath] NVARCHAR(500) NULL,
        [GraphTenantIdEnc] NVARCHAR(1000) NULL,
        [GraphClientIdEnc] NVARCHAR(1000) NULL,
        [GraphClientSecretEnc] NVARCHAR(1000) NULL,
        [GraphSiteHost] NVARCHAR(200) NULL,
        [GraphSitePath] NVARCHAR(200) NULL,
        [GraphUploadPath] NVARCHAR(300) NULL,
        [ModifiedBy] UNIQUEIDENTIFIER NULL,
        [ModifiedAt] DATETIME2 NULL,
        CONSTRAINT [StorageSettings_pkey] PRIMARY KEY CLUSTERED ([Id])
    );
END;

IF COL_LENGTH('dbo.Attachment', 'StorageProvider') IS NULL
BEGIN
    ALTER TABLE [dbo].[Attachment] ADD [StorageProvider] NVARCHAR(10) NULL;
END;

COMMIT TRAN;
PRINT N'Script 09, partie 2 (stockage des fichiers) applique.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
GO
