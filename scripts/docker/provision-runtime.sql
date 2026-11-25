SET NOCOUNT ON;

USE [master];
GO

IF DB_ID(N'FieldOpsDockerDb') IS NULL
    THROW 51000, 'FieldOpsDockerDb does not exist.', 1;

IF SUSER_ID(N'fieldops_app') IS NULL
BEGIN
    CREATE LOGIN [fieldops_app]
    WITH PASSWORD = '__FIELDOPS_APP_PASSWORD__',
         DEFAULT_DATABASE = [FieldOpsDockerDb],
         CHECK_POLICY = ON,
         CHECK_EXPIRATION = OFF;
END;
GO

USE [FieldOpsDockerDb];
GO

IF DATABASE_PRINCIPAL_ID(N'fieldops_app') IS NULL
BEGIN
    CREATE USER [fieldops_app]
    FOR LOGIN [fieldops_app]
    WITH DEFAULT_SCHEMA = [dbo];
END;

IF DATABASE_PRINCIPAL_ID(N'FieldOpsRuntime') IS NULL
BEGIN
    CREATE ROLE [FieldOpsRuntime] AUTHORIZATION [dbo];
END;

IF IS_ROLEMEMBER(N'FieldOpsRuntime', N'fieldops_app') <> 1
BEGIN
    ALTER ROLE [FieldOpsRuntime] ADD MEMBER [fieldops_app];
END;
GO

-- Operational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.Facilities TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.Assets TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.Incidents TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.Technicians TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.WorkOrders TO [FieldOpsRuntime];

-- ASP.NET Core Identity tables
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetUsers TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetRoles TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetUserRoles TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetUserClaims TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetRoleClaims TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetUserLogins TO [FieldOpsRuntime];
GRANT SELECT, INSERT, UPDATE, DELETE ON dbo.AspNetUserTokens TO [FieldOpsRuntime];

-- The runtime account must not manage migrations.
DENY SELECT, INSERT, UPDATE, DELETE
ON dbo.__EFMigrationsHistory TO [FieldOpsRuntime];
GO

-- Verify effective permissions without modifying business data.
EXECUTE AS LOGIN = 'fieldops_app';

IF ISNULL(IS_SRVROLEMEMBER('sysadmin'), -1) <> 0
    THROW 51001, 'Unexpected sysadmin privileges.', 1;

IF ISNULL(IS_ROLEMEMBER('db_owner'), -1) <> 0
    THROW 51002, 'Unexpected database owner privileges.', 1;

IF ISNULL(HAS_PERMS_BY_NAME(NULL, NULL, 'CONTROL SERVER'), 0) <> 0
    THROW 51003, 'Unexpected server control permission.', 1;

IF ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE'), 0) <> 0
    THROW 51004, 'Unexpected CREATE TABLE permission.', 1;

IF ISNULL(HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER'), 0) <> 0
    THROW 51005, 'Unexpected schema modification permission.', 1;

IF ISNULL(HAS_PERMS_BY_NAME('dbo.__EFMigrationsHistory', 'OBJECT', 'UPDATE'), 0) <> 0
    THROW 51006, 'Unexpected migration history permission.', 1;

IF EXISTS (
    SELECT 1
    FROM (VALUES
        ('dbo.Facilities'),
        ('dbo.Assets'),
        ('dbo.Incidents'),
        ('dbo.Technicians'),
        ('dbo.WorkOrders'),
        ('dbo.AspNetUsers'),
        ('dbo.AspNetRoles'),
        ('dbo.AspNetUserRoles'),
        ('dbo.AspNetUserClaims'),
        ('dbo.AspNetRoleClaims'),
        ('dbo.AspNetUserLogins'),
        ('dbo.AspNetUserTokens')
    ) AS tables(TableName)
    CROSS JOIN (VALUES
        ('SELECT'),
        ('INSERT'),
        ('UPDATE'),
        ('DELETE')
    ) AS permissions(PermissionName)
    WHERE ISNULL(
        HAS_PERMS_BY_NAME(
            tables.TableName,
            'OBJECT',
            permissions.PermissionName
        ), 0
    ) <> 1
)
    THROW 51007, 'Required runtime permissions are missing.', 1;

SELECT
    SUSER_SNAME() AS LoginName,
    DB_NAME() AS DatabaseName,
    IS_SRVROLEMEMBER('sysadmin') AS IsSysAdmin,
    IS_ROLEMEMBER('db_owner') AS IsDbOwner,
    HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE TABLE') AS CanCreateTables,
    HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER') AS CanAlterSchema;

REVERT;

PRINT '48 required table permissions verified.';
PRINT 'Runtime permissions verified successfully.';
GO
