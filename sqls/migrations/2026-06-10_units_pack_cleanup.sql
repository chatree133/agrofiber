/*
  Migration: Replace legacy unit REAM with PACK and remove obsolete unit choices.

  Active units for new documents should be:
    PACK, PALLET, PCS, SHEET

  SQM/M3 are removed only when no existing FK references block deletion.
*/

IF OBJECT_ID('dbo.Units', 'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.Units WHERE UnitCode = 'REAM')
     AND NOT EXISTS (SELECT 1 FROM dbo.Units WHERE UnitCode = 'PACK')
  BEGIN
    UPDATE dbo.Units
    SET UnitCode = 'PACK',
        UnitName = N'แพ็ค'
    WHERE UnitCode = 'REAM';
  END
  ELSE IF NOT EXISTS (SELECT 1 FROM dbo.Units WHERE UnitCode = 'PACK')
  BEGIN
    INSERT INTO dbo.Units (UnitCode, UnitName)
    VALUES ('PACK', N'แพ็ค');
  END

  UPDATE dbo.Units
  SET UnitName = N'แพ็ค'
  WHERE UnitCode = 'PACK';

  IF OBJECT_ID('dbo.UnitConversions', 'U') IS NOT NULL
  BEGIN
    INSERT INTO dbo.UnitConversions (FromUnitId, ToUnitId, ConversionFactor)
    SELECT u.UnitId, u.UnitId, 1.00000000
    FROM dbo.Units u
    WHERE u.UnitCode = 'PACK'
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.UnitConversions uc
        WHERE uc.FromUnitId = u.UnitId
          AND uc.ToUnitId = u.UnitId
      );
  END

  IF OBJECT_ID('dbo.ItemUnitConversions', 'U') IS NOT NULL
  BEGIN
    DELETE iuc
    FROM dbo.ItemUnitConversions iuc
    JOIN dbo.Units fu ON fu.UnitId = iuc.FromUnitId
    JOIN dbo.Units tu ON tu.UnitId = iuc.ToUnitId
    WHERE fu.UnitCode IN ('SQM', 'M3')
       OR tu.UnitCode IN ('SQM', 'M3');
  END

  IF OBJECT_ID('dbo.UnitConversions', 'U') IS NOT NULL
  BEGIN
    DELETE uc
    FROM dbo.UnitConversions uc
    JOIN dbo.Units fu ON fu.UnitId = uc.FromUnitId
    JOIN dbo.Units tu ON tu.UnitId = uc.ToUnitId
    WHERE fu.UnitCode IN ('SQM', 'M3')
       OR tu.UnitCode IN ('SQM', 'M3');
  END

  BEGIN TRY
    DELETE FROM dbo.Units WHERE UnitCode IN ('SQM', 'M3');
  END TRY
  BEGIN CATCH
    -- Keep referenced legacy units for historical rows; UI/API filters hide them from new document choices.
  END CATCH
END
