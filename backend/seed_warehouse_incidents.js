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

async function run() {
  console.log('Connecting to database...');
  const pool = await sql.connect(config);
  console.log('Connected to database.');

  try {
    // 1. Fetch a valid user ID
    const userRes = await pool.request().query('SELECT TOP 1 UserId FROM dbo.Users ORDER BY UserId ASC');
    const userId = userRes.recordset[0]?.UserId;
    if (!userId) {
      throw new Error('No user found in dbo.Users table. Please ensure users exist before running seed.');
    }

    // 2. Fetch a valid WMS Task
    const taskRes = await pool.request().query('SELECT TOP 1 WmsTaskId FROM dbo.WmsTasks ORDER BY WmsTaskId DESC');
    let taskId = taskRes.recordset[0]?.WmsTaskId;
    
    // If no WmsTask exists, we must insert a dummy task first (to satisfy FK)
    if (!taskId) {
      console.log('No WmsTask found. Inserting a dummy task...');
      const whRes = await pool.request().query('SELECT TOP 1 WarehouseId FROM dbo.Warehouses');
      const whId = whRes.recordset[0]?.WarehouseId;
      if (!whId) {
        throw new Error('No Warehouse found in dbo.Warehouses. Cannot create dummy WmsTask.');
      }
      
      const insertTaskRes = await pool.request()
        .input('whId', sql.Int, whId)
        .input('userId', sql.Int, userId)
        .query(`
          INSERT INTO dbo.WmsTasks (TaskType, Status, WarehouseId, CreatedBy)
          OUTPUT INSERTED.WmsTaskId
          VALUES ('picking', 'open', @whId, @userId)
        `);
      taskId = insertTaskRes.recordset[0].WmsTaskId;
      console.log(`Dummy WmsTask created with ID: ${taskId}`);
    }

    // 3. Fetch a valid Item
    const itemRes = await pool.request().query('SELECT TOP 1 ItemId FROM dbo.Items ORDER BY ItemId ASC');
    let itemId = itemRes.recordset[0]?.ItemId;
    if (!itemId) {
      throw new Error('No Item found in dbo.Items table. Please ensure items exist.');
    }

    // 4. Delete existing pending seeded incidents to keep it clean
    await pool.request().query("DELETE FROM dbo.WarehouseIncidents WHERE Status = 'pending'");
    console.log('Cleaned up previous pending incidents.');

    // 5. Seed 3 incidents
    const incidents = [
      {
        IncidentType: 'short_pick',
        SourceType: 'SO',
        SourceId: 1001,
        QtyRequired: 10,
        QtyCompleted: 8,
        QtyShortage: 2,
        Condition: 'damaged'
      },
      {
        IncidentType: 'short_pick',
        SourceType: 'GI',
        SourceId: 2005,
        QtyRequired: 15,
        QtyCompleted: 14,
        QtyShortage: 1,
        Condition: 'missing'
      },
      {
        IncidentType: 'short_pick',
        SourceType: 'SO',
        SourceId: 1042,
        QtyRequired: 5,
        QtyCompleted: 0,
        QtyShortage: 5,
        Condition: 'damaged'
      }
    ];

    for (const inc of incidents) {
      await pool.request()
        .input('incType', sql.NVarChar(30), inc.IncidentType)
        .input('taskId', sql.BigInt, taskId)
        .input('sourceType', sql.NVarChar(30), inc.SourceType)
        .input('sourceId', sql.Int, inc.SourceId)
        .input('itemId', sql.Int, itemId)
        .input('reqQty', sql.Decimal(18, 4), inc.QtyRequired)
        .input('compQty', sql.Decimal(18, 4), inc.QtyCompleted)
        .input('shortQty', sql.Decimal(18, 4), inc.QtyShortage)
        .input('userId', sql.Int, userId)
        .input('condition', sql.NVarChar(30), inc.Condition)
        .query(`
          INSERT INTO dbo.WarehouseIncidents (
            IncidentType, Status, WmsTaskId, SourceType, SourceId, ItemId, QtyRequired, QtyCompleted, QtyShortage, CreatedBy, Condition
          ) VALUES (
            @incType, 'pending', @taskId, @sourceType, @sourceId, @itemId, @reqQty, @compQty, @shortQty, @userId, @condition
          )
        `);
      console.log(`Seeded incident for ${inc.SourceType} #${inc.SourceId} (Shortage: ${inc.QtyShortage})`);
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await pool.close();
  }
}

run();
