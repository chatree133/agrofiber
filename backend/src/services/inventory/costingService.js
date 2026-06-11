import { sql } from '../../lib/mssql.js';

export const costingService = {
  async addCostLayer(tx, {
    itemId, itemSpecId = null, lotId = null, warehouseId, movementId, quantity, unitCost
  }) {
    const req = new sql.Request(tx);
    req.input('itemId', sql.Int, itemId);
    req.input('itemSpecId', sql.Int, itemSpecId);
    req.input('lotId', sql.BigInt, lotId);
    req.input('whId', sql.Int, warehouseId);
    req.input('movId', sql.BigInt, movementId);
    req.input('qty', sql.Decimal(18, 4), quantity);
    req.input('cost', sql.Decimal(18, 4), unitCost);

    await req.query(`
      INSERT INTO dbo.InventoryCostLayers (
        ItemId, ItemSpecId, LotId, WarehouseId, SourceMovementId, QuantityOriginal, QuantityRemaining, UnitCost
      )
      VALUES (
        @itemId, @itemSpecId, @lotId, @whId, @movId, @qty, @qty, @cost
      )
    `);
  },

  async consumeFifoLayers(tx, { itemId, itemSpecId = null, warehouseId, lotId = null, quantityToConsume }) {
    let remainingToIssue = quantityToConsume;
    let totalValuationCost = 0;

    const layersReq = new sql.Request(tx);
    layersReq.input('itemId', sql.Int, itemId);
    layersReq.input('itemSpecId', sql.Int, itemSpecId);
    layersReq.input('whId', sql.Int, warehouseId);
    layersReq.input('lotId', sql.BigInt, lotId);
    
    let lotFilter = '';
    if (lotId) {
      lotFilter = 'AND ISNULL(LotId, -1) = @lotId';
    }

    const layersRes = await layersReq.query(`
      SELECT InventoryCostLayerId, QuantityRemaining, UnitCost
      FROM dbo.InventoryCostLayers
      WHERE ItemId = @itemId 
        AND ISNULL(ItemSpecId, -1) = ISNULL(@itemSpecId, -1)
        AND ISNULL(WarehouseId, -1) = ISNULL(@whId, -1) 
        AND QuantityRemaining > 0
      ${lotFilter}
      ORDER BY CreatedAt ASC
    `);
    
    const availableLayers = layersRes.recordset;

    for (const layer of availableLayers) {
      if (remainingToIssue < 1e-5) {
        remainingToIssue = 0;
        break;
      }

      const qtyToTake = Math.min(layer.QuantityRemaining, remainingToIssue);
      remainingToIssue -= qtyToTake;
      totalValuationCost += qtyToTake * layer.UnitCost;

      const updLayerReq = new sql.Request(tx);
      updLayerReq.input('layerId', sql.BigInt, layer.InventoryCostLayerId);
      updLayerReq.input('qty', sql.Decimal(18, 4), qtyToTake);
      await updLayerReq.query(`
        UPDATE dbo.InventoryCostLayers
        SET QuantityRemaining = QuantityRemaining - @qty
        WHERE InventoryCostLayerId = @layerId
      `);
    }

    if (remainingToIssue > 1e-5) {
      throw new Error(`Insufficient stock or layers for Item ID ${itemId}. Short by ${remainingToIssue}`);
    }

    const avgUnitCost = quantityToConsume > 0 ? totalValuationCost / quantityToConsume : 0;
    
    return {
      totalValuationCost,
      avgUnitCost
    };
  },

  async insertValuationMovement(tx, {
    stockMovementId, itemId, itemSpecId = null, lotId = null, quantity, unitCost, totalCost, valuationMethod = 'fifo'
  }) {
    const valReq = new sql.Request(tx);
    valReq.input('movId', sql.BigInt, stockMovementId);
    valReq.input('itemId', sql.Int, itemId);
    valReq.input('itemSpecId', sql.Int, itemSpecId);
    valReq.input('lotId', sql.BigInt, lotId);
    valReq.input('qty', sql.Decimal(18, 4), quantity);
    valReq.input('unitCost', sql.Decimal(18, 4), unitCost);
    valReq.input('totalCost', sql.Decimal(18, 4), totalCost);
    valReq.input('method', sql.NVarChar(30), valuationMethod);
    
    await valReq.query(`
      INSERT INTO dbo.InventoryValuationMovements (
        StockMovementId, ItemId, ItemSpecId, LotId, Quantity, UnitCost, TotalCost, ValuationMethod
      )
      VALUES (
        @movId, @itemId, @itemSpecId, @lotId, @qty, @unitCost, @totalCost, @method
      )
    `);
  }
};
