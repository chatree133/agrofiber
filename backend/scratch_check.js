import dotenv from 'dotenv';
dotenv.config();

import { mssqlQuery } from './src/lib/mssql.js';

async function main() {
  try {
    const branches = await mssqlQuery('DEFAULT', `
      SELECT BranchId, BranchName, Latitude, Longitude FROM dbo.Branches
    `);
    console.log('Branches in database:');
    console.table(branches);
  } catch (err) {
    console.error(err);
  }
}

main();
