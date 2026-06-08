import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/chatreekueakachai/Job/Web dev/agrofiber/backend/.env' });

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
};

console.log('Connecting to database...');

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to MS SQL Server.');

  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const request = new sql.Request(tx);

    // 1. StockMovements
    console.log('Checking and altering dbo.StockMovements...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.StockMovements') AND name = 'ItemSpecId')
      BEGIN
          ALTER TABLE dbo.StockMovements ADD ItemSpecId INT NULL;
          ALTER TABLE dbo.StockMovements ADD CONSTRAINT FK_StockMovements_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
          PRINT 'ItemSpecId column and foreign key successfully added to dbo.StockMovements.';
      END
      ELSE
      BEGIN
          PRINT 'ItemSpecId column already exists in dbo.StockMovements.';
      END
    `);

    // 2. InventoryCostLayers
    console.log('Checking and altering dbo.InventoryCostLayers...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryCostLayers') AND name = 'ItemSpecId')
      BEGIN
          ALTER TABLE dbo.InventoryCostLayers ADD ItemSpecId INT NULL;
          ALTER TABLE dbo.InventoryCostLayers ADD CONSTRAINT FK_InventoryCostLayers_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
          PRINT 'ItemSpecId column and foreign key successfully added to dbo.InventoryCostLayers.';
      END
      ELSE
      BEGIN
          PRINT 'ItemSpecId column already exists in dbo.InventoryCostLayers.';
      END
    `);

    // 3. InventoryValuationMovements
    console.log('Checking and altering dbo.InventoryValuationMovements...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.InventoryValuationMovements') AND name = 'ItemSpecId')
      BEGIN
          ALTER TABLE dbo.InventoryValuationMovements ADD ItemSpecId INT NULL;
          ALTER TABLE dbo.InventoryValuationMovements ADD CONSTRAINT FK_InventoryValuationMovements_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
          PRINT 'ItemSpecId column and foreign key successfully added to dbo.InventoryValuationMovements.';
      END
      ELSE
      BEGIN
          PRINT 'ItemSpecId column already exists in dbo.InventoryValuationMovements.';
      END
    `);

    // 4. Backfill data
    console.log('Backfilling ItemSpecId for existing rows...');

    console.log('Backfilling StockMovements from GR...');
    await request.query(`
      UPDATE sm
      SET sm.ItemSpecId = grl.ItemSpecId
      FROM dbo.StockMovements sm
      JOIN dbo.GoodsReceiptLines grl ON sm.ReferenceType = 'GR' AND sm.ReferenceId = grl.GoodsReceiptId AND sm.ItemId = grl.ItemId AND (sm.LotId = grl.LotId OR (sm.LotId IS NULL AND grl.LotId IS NULL))
      WHERE sm.ItemSpecId IS NULL;
    `);

    console.log('Backfilling StockMovements from GI...');
    await request.query(`
      UPDATE sm
      SET sm.ItemSpecId = gil.ItemSpecId
      FROM dbo.StockMovements sm
      JOIN dbo.GoodsIssueLines gil ON sm.ReferenceType = 'GI' AND sm.ReferenceId = gil.GoodsIssueId AND sm.ItemId = gil.ItemId AND (sm.LotId = gil.LotId OR (sm.LotId IS NULL AND gil.LotId IS NULL))
      WHERE sm.ItemSpecId IS NULL;
    `);

    console.log('Backfilling StockMovements from WMS...');
    await request.query(`
      UPDATE sm
      SET sm.ItemSpecId = wtl.ItemSpecId
      FROM dbo.StockMovements sm
      JOIN dbo.WmsTaskLines wtl ON sm.ReferenceType = 'WMS' AND sm.ReferenceId = wtl.WmsTaskId AND sm.ItemId = wtl.ItemId AND (sm.LotId = wtl.LotId OR (sm.LotId IS NULL AND wtl.LotId IS NULL))
      WHERE sm.ItemSpecId IS NULL;
    `);

    console.log('Backfilling InventoryCostLayers from StockMovements...');
    await request.query(`
      UPDATE icl
      SET icl.ItemSpecId = sm.ItemSpecId
      FROM dbo.InventoryCostLayers icl
      JOIN dbo.StockMovements sm ON icl.SourceMovementId = sm.StockMovementId
      WHERE icl.ItemSpecId IS NULL;
    `);

    console.log('Backfilling InventoryValuationMovements from StockMovements...');
    await request.query(`
      UPDATE ivm
      SET ivm.ItemSpecId = sm.ItemSpecId
      FROM dbo.InventoryValuationMovements ivm
      JOIN dbo.StockMovements sm ON ivm.StockMovementId = sm.StockMovementId
      WHERE ivm.ItemSpecId IS NULL;
    `);

    await tx.commit();
    console.log('Database migration successfully committed!');
  } catch (err) {
    await tx.rollback();
    console.error('Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

run().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
