import dotenv from 'dotenv';
dotenv.config();

import { sql, mssqlQuery } from './src/lib/mssql.js';

async function main() {
  try {
    const columns1 = await mssqlQuery('DEFAULT', `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'WarehouseLocations'
    `);
    console.log('WarehouseLocations columns:');
    console.table(columns1);

    const columns2 = await mssqlQuery('DEFAULT', `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'Warehouses'
    `);
    console.log('Warehouses columns:');
    console.table(columns2);

  } catch (err) {
    console.error(err);
  }
}

main();
