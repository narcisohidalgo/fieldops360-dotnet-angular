IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
CREATE TABLE [Facilities] (
    [Id] uniqueidentifier NOT NULL,
    [Code] nvarchar(30) NOT NULL,
    [Name] nvarchar(150) NOT NULL,
    [City] nvarchar(100) NOT NULL,
    [Address] nvarchar(250) NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_Facilities] PRIMARY KEY ([Id])
);

CREATE TABLE [Assets] (
    [Id] uniqueidentifier NOT NULL,
    [FacilityId] uniqueidentifier NOT NULL,
    [Code] nvarchar(50) NOT NULL,
    [Name] nvarchar(150) NOT NULL,
    [Description] nvarchar(500) NULL,
    [IsActive] bit NOT NULL,
    CONSTRAINT [PK_Assets] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_Assets_Facilities_FacilityId] FOREIGN KEY ([FacilityId]) REFERENCES [Facilities] ([Id]) ON DELETE NO ACTION
);

CREATE UNIQUE INDEX [IX_Assets_FacilityId_Code] ON [Assets] ([FacilityId], [Code]);

CREATE UNIQUE INDEX [IX_Facilities_Code] ON [Facilities] ([Code]);

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20261120060431_InitialCreate', N'10.0.14');

COMMIT;
GO
