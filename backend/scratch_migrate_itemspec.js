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

    console.log('Adding ItemSpecId to QuotationLines...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.QuotationLines') AND name = 'ItemSpecId')
      BEGIN
          ALTER TABLE dbo.QuotationLines ADD ItemSpecId INT NULL;
          ALTER TABLE dbo.QuotationLines ADD CONSTRAINT FK_QuotationLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
          PRINT 'ItemSpecId column and FK constraint added to dbo.QuotationLines.';
      END
      ELSE
      BEGIN
          PRINT 'ItemSpecId column already exists in dbo.QuotationLines.';
      END
    `);

    console.log('Adding ItemSpecId to SalesInvoiceLines...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SalesInvoiceLines') AND name = 'ItemSpecId')
      BEGIN
          ALTER TABLE dbo.SalesInvoiceLines ADD ItemSpecId INT NULL;
          ALTER TABLE dbo.SalesInvoiceLines ADD CONSTRAINT FK_SalesInvoiceLines_ItemSpecs FOREIGN KEY (ItemSpecId) REFERENCES dbo.ItemSpecs(ItemSpecId);
          PRINT 'ItemSpecId column and FK constraint added to dbo.SalesInvoiceLines.';
      END
      ELSE
      BEGIN
          PRINT 'ItemSpecId column already exists in dbo.SalesInvoiceLines.';
      END
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
