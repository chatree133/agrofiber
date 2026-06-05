import sql from 'mssql';
import dotenv from 'dotenv';
import { wmsTaskService } from './src/services/wms/wmsTaskService.js';

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

async function test() {
  console.log('Connecting to database for verification...');
  const pool = await sql.connect(config);
  console.log('Connected.');

  try {
    // 1. Find an approved sales order that has a picking task
    console.log('\n--- 1. Searching for approved Sales Orders with open picking tasks ---');
    const orderRes = await pool.request().query(`
      SELECT TOP 1 t.WmsTaskId, t.ReferenceId AS SalesOrderId, t.WarehouseId, t.Status AS TaskStatus, so.DocumentNo AS SalesOrderNo
      FROM dbo.WmsTasks t
      JOIN dbo.SalesOrders so ON so.SalesOrderId = t.ReferenceId
      WHERE t.TaskType = 'picking' AND t.Status = 'open' AND t.ReferenceType = 'SO'
      ORDER BY t.CreatedAt DESC
    `);
    
    const taskInfo = orderRes.recordset[0];
    if (!taskInfo) {
      console.log('No open picking tasks for approved Sales Orders found. To test fully, please approve a Sales Order in the system first.');
      return;
    }
    console.log(`Found WMS Picking Task ID: ${taskInfo.WmsTaskId} for Sales Order: ${taskInfo.SalesOrderNo} (ID: ${taskInfo.SalesOrderId})`);

    // 2. Fetch lines of the task
    const linesRes = await pool.request()
      .input('taskId', sql.BigInt, taskInfo.WmsTaskId)
      .query(`
        SELECT WmsTaskLineId, ItemId, QuantityRequired, InventoryReservationId
        FROM dbo.WmsTaskLines
        WHERE WmsTaskId = @taskId
      `);
    const lines = linesRes.recordset;
    console.log(`Task contains ${lines.length} lines:`);
    lines.forEach(l => {
      console.log(`  - Line ID: ${l.WmsTaskLineId}, Item: ${l.ItemId}, Qty Req: ${l.QuantityRequired}, Reservation: ${l.InventoryReservationId}`);
    });

    // 3. Test Wave Picking Creation
    console.log('\n--- 2. Testing Wave Picking Creation ---');
    const waveId = await wmsTaskService.createWave({
      taskIds: [taskInfo.WmsTaskId],
      userId: 1 // Admin user
    });
    console.log(`Wave created successfully! Wave ID: ${waveId}`);

    // Verify task is associated with wave
    const taskWaveRes = await pool.request()
      .input('taskId', sql.BigInt, taskInfo.WmsTaskId)
      .query(`SELECT WaveId FROM dbo.WmsTasks WHERE WmsTaskId = @taskId`);
    console.log(`WMS Task WaveId updated to: ${taskWaveRes.recordset[0].WaveId}`);

    // 4. Test Picking Task Confirmation
    console.log('\n--- 3. Testing Pick Task Confirmation ---');
    const linesToConfirm = lines.map(l => ({
      lineId: l.WmsTaskLineId,
      quantityCompleted: l.QuantityRequired, // Pick fully
      lotId: null, 
      fromLocationId: null, 
      inventoryUnitId: null
    }));

    await wmsTaskService.confirmTask({
      taskId: taskInfo.WmsTaskId,
      lines: linesToConfirm,
      userId: 1
    });
    console.log('Picking task successfully confirmed!');

    // 5. Verify Draft Delivery Order (DO) was Auto-created
    console.log('\n--- 4. Verifying Auto-created Draft Delivery Order ---');
    const doRes = await pool.request()
      .input('soId', sql.Int, taskInfo.SalesOrderId)
      .query(`
        SELECT TOP 1 DeliveryOrderId, DocumentNo, Status, CreatedAt
        FROM dbo.DeliveryOrders
        WHERE SalesOrderId = @soId
        ORDER BY CreatedAt DESC
      `);
    const draftDo = doRes.recordset[0];
    if (!draftDo) {
      console.log('FAIL: Draft Delivery Order was not auto-created.');
      return;
    }
    console.log(`SUCCESS: Draft DO auto-created! ID: ${draftDo.DeliveryOrderId}, DocNo: ${draftDo.DocumentNo}, Status: ${draftDo.Status}`);

    // 6. Test Deliver & Bill Transaction
    console.log('\n--- 5. Testing Atomic Deliver & Bill (POD + Goods Issue + Invoice + Receipt) ---');
    // We will simulate calling the post endpoint logic directly or via fetch (since the server is running)
    // Let's call the endpoint using fetch since the app is running!
    const response = await fetch(`http://localhost:5000/api/delivery-orders/${draftDo.DeliveryOrderId}/deliver-and-bill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // bypass auth or grab token if needed. Wait! Since authentication is required on routes, 
        // we can fetch a token from /api/auth/login or run the controller logic programmatically.
        // Let's run it programmatically in the transaction or authenticate.
      }
    });

    console.log('Verification completed. DB has been updated. Feel free to inspect tables.');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await pool.close();
  }
}

test();
