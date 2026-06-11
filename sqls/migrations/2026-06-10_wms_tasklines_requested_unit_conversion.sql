/*
  Migration: Store requested/display quantity on WMS task lines.

  WmsTaskLines.QuantityRequired/QuantityCompleted/UnitId remain the stock-execution
  quantity/unit (item base unit). RequestedQuantity/RequestedUnitId preserve the
  source document quantity/unit for warehouse display.
*/

IF OBJECT_ID('dbo.WmsTaskLines', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.WmsTaskLines', 'RequestedQuantity') IS NULL
    ALTER TABLE dbo.WmsTaskLines ADD RequestedQuantity DECIMAL(18,4) NULL;

  IF COL_LENGTH('dbo.WmsTaskLines', 'RequestedUnitId') IS NULL
    ALTER TABLE dbo.WmsTaskLines ADD RequestedUnitId INT NULL;

  IF COL_LENGTH('dbo.WmsTaskLines', 'UnitConversionFactor') IS NULL
    ALTER TABLE dbo.WmsTaskLines ADD UnitConversionFactor DECIMAL(18,8) NULL;

  EXEC('
    UPDATE dbo.WmsTaskLines
    SET
      RequestedQuantity = ISNULL(RequestedQuantity, QuantityRequired),
      RequestedUnitId = ISNULL(RequestedUnitId, UnitId),
      UnitConversionFactor = ISNULL(UnitConversionFactor, 1)
    WHERE RequestedQuantity IS NULL
       OR RequestedUnitId IS NULL
       OR UnitConversionFactor IS NULL
  ');

  IF OBJECT_ID('dbo.Units', 'U') IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_WmsTaskLines_RequestedUnits')
    BEGIN
      BEGIN TRY
        ALTER TABLE dbo.WmsTaskLines WITH CHECK
        ADD CONSTRAINT FK_WmsTaskLines_RequestedUnits FOREIGN KEY (RequestedUnitId) REFERENCES dbo.Units(UnitId);
      END TRY
      BEGIN CATCH
        -- ignore FK failure if data is dirty
      END CATCH
    END
  END
END
