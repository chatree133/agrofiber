import dotenv from 'dotenv';
dotenv.config();

import { sql, mssqlQuery } from './src/lib/mssql.js';

async function main() {
  try {
    const vehicles = await mssqlQuery('DEFAULT', `
      SELECT VehicleId, LicensePlate, VehicleType, MaxWeightKg, MaxVolumeCbm FROM dbo.Vehicles
    `);
    console.log('Vehicles:');
    console.table(vehicles);

    const drivers = await mssqlQuery('DEFAULT', `
      SELECT DriverId, DriverName, Phone, PreferredProvince FROM dbo.Drivers
    `);
    console.log('Drivers:');
    console.table(drivers);

    const colCheck = await mssqlQuery('DEFAULT', `
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'SalesOrders' AND COLUMN_NAME = 'DeliveryType'
    `);
    console.log('SalesOrders columns check:');
    console.table(colCheck);

  } catch (err) {
    console.error(err);
  }
}

main();
