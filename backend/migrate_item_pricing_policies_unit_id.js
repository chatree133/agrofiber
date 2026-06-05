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

    console.log('Step 1: Checking and adding UnitId column to dbo.ItemPricingPolicies...');
    await request.query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ItemPricingPolicies') AND name = 'UnitId')
      BEGIN
          ALTER TABLE dbo.ItemPricingPolicies ADD UnitId INT NULL;
          PRINT 'UnitId column successfully added (as NULLable) to dbo.ItemPricingPolicies.';
      END
      ELSE
      BEGIN
          PRINT 'UnitId column already exists in dbo.ItemPricingPolicies.';
      END
    `);

    console.log('Step 2: Populating UnitId with default UnitId from dbo.Items for existing policies...');
    await request.query(`
      UPDATE ipp
      SET ipp.UnitId = i.UnitId
      FROM dbo.ItemPricingPolicies ipp
      JOIN dbo.Items i ON i.ItemId = ipp.ItemId
      WHERE ipp.UnitId IS NULL;
      PRINT 'Populated standard UnitId for legacy policies.';
    `);

    console.log('Step 3: Altering UnitId column to NOT NULL and adding Foreign Key constraint...');
    await request.query(`
      -- Alter column to NOT NULL
      ALTER TABLE dbo.ItemPricingPolicies ALTER COLUMN UnitId INT NOT NULL;
      PRINT 'UnitId column made NOT NULL.';

      -- Add Foreign Key constraint if not exists
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ItemPricingPolicies_Units')
      BEGIN
          ALTER TABLE dbo.ItemPricingPolicies 
          ADD CONSTRAINT FK_ItemPricingPolicies_Units FOREIGN KEY (UnitId) REFERENCES dbo.Units(UnitId);
          PRINT 'Foreign Key constraint FK_ItemPricingPolicies_Units successfully added.';
      END
      ELSE
      BEGIN
          PRINT 'Foreign Key constraint FK_ItemPricingPolicies_Units already exists.';
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
