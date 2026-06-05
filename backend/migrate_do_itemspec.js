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

    // 1. Add ItemSpecId to DeliveryOrderLines
    console.log('Adding ItemSpecId column to dbo.DeliveryOrderLines...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DeliveryOrderLines') AND name = 'ItemSpecId')
      BEGIN
          ALTER TABLE dbo.DeliveryOrderLines ADD ItemSpecId INT NULL;
          ALTER TABLE dbo.DeliveryOrderLines ADD CONSTRAINT FK_DeliveryOrderLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
          PRINT 'ItemSpecId column and foreign key added to dbo.DeliveryOrderLines.';
      END
      ELSE
      BEGIN
          PRINT 'ItemSpecId column already exists in dbo.DeliveryOrderLines.';
      END
    `);

    // 2. Backfill existing records
    console.log('Backfilling ItemSpecId for existing DeliveryOrderLines...');
    const updateRes = await request.query(`
      UPDATE dol
      SET dol.ItemSpecId = sol.ItemSpecId
      FROM dbo.DeliveryOrderLines dol
      JOIN dbo.DeliveryOrders do ON do.DeliveryOrderId = dol.DeliveryOrderId
      JOIN dbo.SalesOrderLines sol ON sol.SalesOrderId = do.SalesOrderId AND sol.ItemId = dol.ItemId
      WHERE dol.ItemSpecId IS NULL;
    `);
    console.log(`Backfilled ${updateRes.rowsAffected[0] || 0} rows.`);

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
