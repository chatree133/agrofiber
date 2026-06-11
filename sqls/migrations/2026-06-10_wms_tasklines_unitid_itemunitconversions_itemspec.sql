/*
  Migration: Add UnitId to dbo.WmsTaskLines + add ItemSpecId to dbo.ItemUnitConversions

  Use when upgrading an existing database that may be missing the new columns/constraints
  used by backend WMS + item conversions.
*/

-- -------------------------------------------------------------------
-- dbo.WmsTaskLines.UnitId (UOM)
-- -------------------------------------------------------------------
IF OBJECT_ID('dbo.WmsTaskLines', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.WmsTaskLines', 'UnitId') IS NULL
  BEGIN
    ALTER TABLE dbo.WmsTaskLines ADD UnitId INT NULL;

    -- Backfill from item base unit
    UPDATE l
    SET UnitId = i.UnitId
    FROM dbo.WmsTaskLines l
    JOIN dbo.Items i ON i.ItemId = l.ItemId
    WHERE l.UnitId IS NULL;

    -- Make NOT NULL after backfill (best-effort)
    BEGIN TRY
      ALTER TABLE dbo.WmsTaskLines ALTER COLUMN UnitId INT NOT NULL;
    END TRY
    BEGIN CATCH
      -- Leave as NULLable if existing rows cannot be backfilled.
    END CATCH
  END

  IF OBJECT_ID('dbo.Units', 'U') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsTaskLines_Units')
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.WmsTaskLines WITH CHECK
        ADD CONSTRAINT FK_WmsTaskLines_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId);
      END TRY
      BEGIN CATCH
        -- ignore FK failure if data is dirty
      END CATCH
    END
  END
END

-- -------------------------------------------------------------------
-- dbo.ItemUnitConversions.ItemSpecId (override by spec)
-- -------------------------------------------------------------------
IF OBJECT_ID('dbo.ItemUnitConversions', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.ItemUnitConversions', 'ItemSpecId') IS NULL
    ALTER TABLE dbo.ItemUnitConversions ADD ItemSpecId INT NULL;

  -- Replace unique constraint to include ItemSpecId
  IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_ItemUnitConversions' AND parent_object_id = OBJECT_ID('dbo.ItemUnitConversions'))
  BEGIN
    BEGIN TRY
      ALTER TABLE dbo.ItemUnitConversions DROP CONSTRAINT UQ_ItemUnitConversions;
    END TRY
    BEGIN CATCH
      -- ignore
    END CATCH
  END

  IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_ItemUnitConversions' AND parent_object_id = OBJECT_ID('dbo.ItemUnitConversions'))
  BEGIN
    BEGIN TRY
      ALTER TABLE dbo.ItemUnitConversions
      ADD CONSTRAINT UQ_ItemUnitConversions UNIQUE (ItemId, ItemSpecId, FromUnitId, ToUnitId, EffectiveFrom);
    END TRY
    BEGIN CATCH
      -- ignore
    END CATCH
  END

  IF OBJECT_ID('dbo.ItemSpecs', 'U') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ItemUnitConversions_ItemSpecs')
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.ItemUnitConversions WITH CHECK
        ADD CONSTRAINT FK_ItemUnitConversions_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
      END TRY
      BEGIN CATCH
        -- ignore FK failure if data is dirty
      END CATCH
    END
  END
END

