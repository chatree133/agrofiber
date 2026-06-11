import { sql } from '../../lib/mssql.js';

export const stockService = {
  async insertStockMovement(tx, {
    movementType, referenceType, referenceId, itemId, itemSpecId = null,
    fromWarehouseId = null, fromLocationId = null,
    toWarehouseId = null, toLocationId = null,
    lotId = null, lotNo = null, quantity,
    unitId = null, unitCost = null, totalCost = null, createdBy
  }) {
    const req = new sql.Request(tx);
    req.input('movType', sql.NVarChar(40), movementType);
    req.input('refType', sql.NVarChar(40), referenceType);
    req.input('refId', sql.Int, referenceId);
    req.input('itemId', sql.Int, itemId);
    req.input('itemSpecId', sql.Int, itemSpecId);
    req.input('fromWhId', sql.Int, fromWarehouseId);
    req.input('fromLocId', sql.Int, fromLocationId);
    req.input('toWhId', sql.Int, toWarehouseId);
    req.input('toLocId', sql.Int, toLocationId);
    req.input('lotId', sql.BigInt, lotId);
    req.input('lotNo', sql.NVarChar(80), lotNo);
    req.input('qty', sql.Decimal(18, 4), quantity);
    req.input('unitId', sql.Int, unitId);
    req.input('unitCost', sql.Decimal(18, 4), unitCost);
    req.input('totalCost', sql.Decimal(18, 4), totalCost);
    req.input('createdBy', sql.Int, createdBy);

    const res = await req.query(`
      INSERT INTO dbo.StockMovements (
        MovementType, ReferenceType, ReferenceId, ItemId, ItemSpecId,
        FromWarehouseId, FromLocationId, ToWarehouseId, ToLocationId, 
        LotId, LotNo, Quantity, UnitId, UnitCost, TotalCost, CreatedBy
      )
      OUTPUT INSERTED.StockMovementId
      VALUES (
        @movType, @refType, @refId, @itemId, @itemSpecId,
        @fromWhId, @fromLocId, @toWhId, @toLocId, 
        @lotId, @lotNo, @qty, @unitId, @unitCost, @totalCost, @createdBy
      )
    `);
    return res.recordset[0].StockMovementId;
  },

  async updateStockOnHand(tx, {
    itemId, itemSpecId = null, warehouseId, locationId = null,
    lotId = null, lotNo = null, quantityDelta
  }) {
    const req = new sql.Request(tx);
    req.input('itemId', sql.Int, itemId);
    req.input('itemSpecId', sql.Int, itemSpecId);
    req.input('whId', sql.Int, warehouseId);
    req.input('locId', sql.Int, locationId);
    req.input('lotId', sql.BigInt, lotId);
    req.input('lotNo', sql.NVarChar(80), lotNo);
    req.input('qty', sql.Decimal(18, 4), quantityDelta);

    await req.query(`
      MERGE dbo.StockOnHand WITH (HOLDLOCK) AS target
      USING (SELECT @itemId AS ItemId, @itemSpecId AS ItemSpecId, @whId AS WarehouseId, @locId AS LocationId, @lotId AS LotId, @lotNo AS LotNo) AS source
      ON (target.ItemId = source.ItemId 
          AND ISNULL(target.ItemSpecId, -1) = ISNULL(source.ItemSpecId, -1)
          AND target.WarehouseId = source.WarehouseId 
          AND ISNULL(target.LocationId, -1) = ISNULL(source.LocationId, -1)
          AND ISNULL(target.LotId, -1) = ISNULL(source.LotId, -1)
          AND ISNULL(target.LotNo, '') = ISNULL(source.LotNo, ''))
      WHEN MATCHED THEN
          UPDATE SET target.QuantityOnHand = target.QuantityOnHand + @qty, target.UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
          INSERT (ItemId, ItemSpecId, WarehouseId, LocationId, LotId, LotNo, QuantityOnHand)
          VALUES (@itemId, @itemSpecId, @whId, @locId, @lotId, @lotNo, @qty);
    `);
  }
};
