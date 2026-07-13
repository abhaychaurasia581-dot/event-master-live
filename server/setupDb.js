const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      multipleStatements: true
    });

    console.log('Connected to MySQL...');

    let schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    
    // Replace the database name in the SQL file with the one we created
    schema = schema.replace(/event_management/g, 'event_db');

    console.log('Executing schema to create tables...');
    await connection.query(schema);
    
    console.log('✅ Database tables created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating tables:', err);
    process.exit(1);
  }
}

setupDatabase();
