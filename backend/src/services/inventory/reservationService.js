import { sql } from '../../lib/mssql.js';

export const reservationService = {
  /**
   * Sync reservations for a Sales Order when it is approved.
   * This is executed within an existing transaction.
   */
  async syncReservationsForApprovedOrder(tx, salesOrderId, lines, changedBy) {
    for (const line of lines) {
      // For now we reserve at item/spec level without lot/location assignment.
      const existingReq = new sql.Request(tx);
      existingReq.input('salesOrderId', sql.Int, salesOrderId);
      existingReq.input('salesOrderLineId', sql.Int, line.SalesOrderLineId);
      const existingRes = await existingReq.query(`
        SELECT TOP 1 InventoryReservationId
        FROM dbo.InventoryReservations
        WHERE ReferenceType = 'SO'
          AND ReferenceId = @salesOrderId
          AND ReferenceLineId = @salesOrderLineId
          AND Status IN ('open', 'allocated', 'picked')
      `);

      if (existingRes.recordset.length > 0) {
        const updateReq = new sql.Request(tx);
        updateReq.input('reservationId', sql.BigInt, existingRes.recordset[0].InventoryReservationId);
        updateReq.input('itemId', sql.Int, line.ItemId);
        updateReq.input('itemSpecId', sql.Int, line.ItemSpecId);
        updateReq.input('reservedQty', sql.Decimal(18, 4), line.Quantity);
        
        await updateReq.query(`
          UPDATE dbo.InventoryReservations
          SET
            ItemId = @itemId,
            ItemSpecId = @itemSpecId,
            ReservedQty = @reservedQty
          WHERE InventoryReservationId = @reservationId
        `);
        continue;
      }

      const insertReq = new sql.Request(tx);
      insertReq.input('salesOrderId', sql.Int, salesOrderId);
      insertReq.input('salesOrderLineId', sql.Int, line.SalesOrderLineId);
      insertReq.input('itemId', sql.Int, line.ItemId);
      insertReq.input('itemSpecId', sql.Int, line.ItemSpecId);
      insertReq.input('reservedQty', sql.Decimal(18, 4), line.Quantity);

      await insertReq.query(`
        INSERT INTO dbo.InventoryReservations (
          ReferenceType, ReferenceId, ReferenceLineId, ItemId, ItemSpecId, 
          ReservedQty, PickedQty, Status
        )
        VALUES (
          'SO', @salesOrderId, @salesOrderLineId, @itemId, @itemSpecId, 
          @reservedQty, 0, 'open'
        )
      `);
    }

    // Release reservations for deleted lines (no longer exist).
    const deleteReq = new sql.Request(tx);
    deleteReq.input('salesOrderId', sql.Int, salesOrderId);
    await deleteReq.query(`
      UPDATE ir
      SET Status = 'released'
      FROM dbo.InventoryReservations ir
      WHERE ir.ReferenceType = 'SO'
        AND ir.ReferenceId = @salesOrderId
        AND ir.Status IN ('open', 'allocated', 'picked')
        AND NOT EXISTS (
          SELECT 1
          FROM dbo.SalesOrderLines sol
          WHERE sol.SalesOrderId = @salesOrderId
            AND sol.SalesOrderLineId = ir.ReferenceLineId
        )
    `);
  }
};
