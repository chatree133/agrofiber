/*
  Migration: WMS action tracking fields + indexes

  Use this when upgrading an existing database that may be missing columns/constraints
  used by backend/src/routes/wms.js and backend/src/services/wms/wmsTaskService.js.

  Notes:
  - Some ALTER TABLE ... ADD CONSTRAINT statements can fail if existing data violates the FK.
  - Run in a maintenance window and validate data first if this is a production database.
*/

-- Ensure required roles exist (for API authorization)
IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleCode = 'warehouse')
    INSERT INTO dbo.Roles (RoleCode, RoleName) VALUES ('warehouse', 'Warehouse Operator');

  IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleCode = 'warehouse_manager')
    INSERT INTO dbo.Roles (RoleCode, RoleName) VALUES ('warehouse_manager', 'Warehouse Manager');
END

-- Ensure dbo.WmsWaves columns
IF OBJECT_ID('dbo.WmsWaves', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.WmsWaves', 'ActionBy') IS NULL
    ALTER TABLE dbo.WmsWaves ADD ActionBy INT NULL;

  IF COL_LENGTH('dbo.WmsWaves', 'ActionAt') IS NULL
    ALTER TABLE dbo.WmsWaves ADD ActionAt DATETIME2 NULL;

  IF COL_LENGTH('dbo.WmsWaves', 'CompletedAt') IS NULL
    ALTER TABLE dbo.WmsWaves ADD CompletedAt DATETIME2 NULL;
END

-- Ensure dbo.WmsTasks columns
IF OBJECT_ID('dbo.WmsTasks', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.WmsTasks', 'AssignedTo') IS NULL
    ALTER TABLE dbo.WmsTasks ADD AssignedTo INT NULL;

  IF COL_LENGTH('dbo.WmsTasks', 'ActionBy') IS NULL
    ALTER TABLE dbo.WmsTasks ADD ActionBy INT NULL;

  IF COL_LENGTH('dbo.WmsTasks', 'ActionAt') IS NULL
    ALTER TABLE dbo.WmsTasks ADD ActionAt DATETIME2 NULL;

  IF COL_LENGTH('dbo.WmsTasks', 'CompletedAt') IS NULL
    ALTER TABLE dbo.WmsTasks ADD CompletedAt DATETIME2 NULL;

  IF COL_LENGTH('dbo.WmsTasks', 'CompletedBy') IS NULL
    ALTER TABLE dbo.WmsTasks ADD CompletedBy INT NULL;

  IF COL_LENGTH('dbo.WmsTasks', 'WaveId') IS NULL
    ALTER TABLE dbo.WmsTasks ADD WaveId INT NULL;
END

-- Foreign keys (best-effort; may fail if data is dirty)
IF OBJECT_ID('dbo.WmsWaves', 'U') IS NOT NULL AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsWaves_ActionBy')
    ALTER TABLE dbo.WmsWaves WITH CHECK
    ADD CONSTRAINT FK_WmsWaves_ActionBy FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserId);
END

IF OBJECT_ID('dbo.WmsTasks', 'U') IS NOT NULL AND OBJECT_ID('dbo.Users', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsTasks_Users')
    ALTER TABLE dbo.WmsTasks WITH CHECK
    ADD CONSTRAINT FK_WmsTasks_Users FOREIGN KEY (AssignedTo) REFERENCES dbo.Users(UserId);

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsTasks_ActionBy')
    ALTER TABLE dbo.WmsTasks WITH CHECK
    ADD CONSTRAINT FK_WmsTasks_ActionBy FOREIGN KEY (ActionBy) REFERENCES dbo.Users(UserId);

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsTasks_CompletedBy')
    ALTER TABLE dbo.WmsTasks WITH CHECK
    ADD CONSTRAINT FK_WmsTasks_CompletedBy FOREIGN KEY (CompletedBy) REFERENCES dbo.Users(UserId);
END

IF OBJECT_ID('dbo.WmsTasks', 'U') IS NOT NULL AND OBJECT_ID('dbo.WmsWaves', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsTasks_WmsWaves')
    ALTER TABLE dbo.WmsTasks WITH CHECK
    ADD CONSTRAINT FK_WmsTasks_WmsWaves FOREIGN KEY (WaveId) REFERENCES dbo.WmsWaves(WmsWaveId);
END

-- Indexes for common filters / wave completion checks
IF OBJECT_ID('dbo.WmsTasks', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WmsTasks_WaveId_Status' AND object_id = OBJECT_ID('dbo.WmsTasks'))
    CREATE INDEX IX_WmsTasks_WaveId_Status ON dbo.WmsTasks (WaveId, Status);

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WmsTasks_WarehouseId_Status' AND object_id = OBJECT_ID('dbo.WmsTasks'))
    CREATE INDEX IX_WmsTasks_WarehouseId_Status ON dbo.WmsTasks (WarehouseId, Status);
END

IF OBJECT_ID('dbo.WmsWaves', 'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WmsWaves_Status' AND object_id = OBJECT_ID('dbo.WmsWaves'))
    CREATE INDEX IX_WmsWaves_Status ON dbo.WmsWaves (Status);
END
