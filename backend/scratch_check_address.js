import dotenv from 'dotenv';
dotenv.config();

import { mssqlQuery } from './src/lib/mssql.js';

async function main() {
  try {
    const doColumns = await mssqlQuery('DEFAULT', `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'DeliveryOrders'
    `);
    console.log('DeliveryOrders Columns:');
    console.table(doColumns);

    const addressColumns = await mssqlQuery('DEFAULT', `
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'CustomerAddresses'
    `);
    console.log('CustomerAddresses Columns:');
    console.table(addressColumns);

  } catch (err) {
    console.error(err);
  }
}

main();
