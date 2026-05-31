const fs = require('fs');

let sql = fs.readFileSync('sqls/mariadb_thailand-geodata.sql', 'utf8');

// 1. Remove comments
sql = sql.replace(/\/\*!.*?\*\//g, '');
sql = sql.replace(/--.*$/gm, '');

// 2. Remove LOCK TABLES / UNLOCK TABLES
sql = sql.replace(/LOCK TABLES.*?;\n/g, '');
sql = sql.replace(/UNLOCK TABLES.*?;\n/g, '');

// 3. Remove backticks
sql = sql.replace(/`/g, '');

// 4. Data types
sql = sql.replace(/\bint\(\d+\)/ig, 'INT');
sql = sql.replace(/\bvarchar\((\d+)\)/ig, 'NVARCHAR($1)');
sql = sql.replace(/\btimestamp\b/ig, 'DATETIME2');

// 5. Constraints and specifics
sql = sql.replace(/ AUTO_INCREMENT=\d+/ig, '');
sql = sql.replace(/ DEFAULT CHARSET=[a-zA-Z0-9_]+/ig, '');
sql = sql.replace(/ COLLATE=[a-zA-Z0-9_]+/ig, '');
sql = sql.replace(/ COLLATE [a-zA-Z0-9_]+/ig, '');
sql = sql.replace(/ ENGINE=[a-zA-Z0-9_]+/ig, '');
sql = sql.replace(/ AUTO_INCREMENT/ig, ' IDENTITY(1,1)');
sql = sql.replace(/ ON UPDATE current_timestamp\(\)/ig, '');
sql = sql.replace(/ DEFAULT current_timestamp\(\)/ig, ' DEFAULT SYSUTCDATETIME()');

// 6. Fix Keys
sql = sql.replace(/UNIQUE KEY\s+(\w+)\s+\((.*?)\)/ig, 'CONSTRAINT UQ_$1 UNIQUE ($2)');
sql = sql.replace(/,\s*KEY\s+\w+\s+\(.*?\)/ig, '');

// 7. Split inserts into batches of 900 records
let newSql = '';
const insertRegex = /INSERT INTO (\w+) VALUES \((.*)\);/g;
let lastIndex = 0;
let match;

while ((match = insertRegex.exec(sql)) !== null) {
    newSql += sql.substring(lastIndex, match.index);
    const tableName = match[1];
    
    let valuesString = match[2];
    
    let rows = valuesString.split(/\),\s*\(/);
    
    for(let i = 0; i < rows.length; i++) {
        if (i !== 0) rows[i] = '(' + rows[i];
        if (i !== rows.length - 1) rows[i] = rows[i] + ')';
    }
    if (!rows[0].startsWith('(')) rows[0] = '(' + rows[0];
    if (!rows[rows.length-1].endsWith(')')) rows[rows.length-1] = rows[rows.length-1] + ')';
    
    const BATCH_SIZE = 900;
    
    newSql += `\nSET IDENTITY_INSERT [${tableName}] ON;\n`;
    for(let i = 0; i < rows.length; i+= BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE).map(row => {
            // Replace strings with N'...'
            return row.replace(/'(?:''|[^'])*'/g, m => 'N' + m);
        });
        newSql += `INSERT INTO [${tableName}] VALUES ${batch.join(',')};\n`;
    }
    newSql += `SET IDENTITY_INSERT [${tableName}] OFF;\n`;

    lastIndex = insertRegex.lastIndex;
}

newSql += sql.substring(lastIndex);

// Add brackets to table names in CREATE and DROP
newSql = newSql.replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE [$1]');
newSql = newSql.replace(/DROP TABLE IF EXISTS (\w+)/g, 'DROP TABLE IF EXISTS [$1]');

// Clean up empty lines and UN leftover
newSql = newSql.replace(/\n\s*\n/g, '\n\n');
newSql = newSql.replace(/^UN;?$/gm, '');

fs.writeFileSync('sqls/mssql_thailand-geodata.sql', newSql);
console.log('Conversion successful with N prefix. Output saved to sqls/mssql_thailand-geodata.sql');
