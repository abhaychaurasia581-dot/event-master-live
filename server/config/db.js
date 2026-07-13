const mysql = require('mysql2/promise');
const env = require('./env');
const logger = require('../utils/logger');

const pool = mysql.createPool({
  host: env.dbHost,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    logger.info(`MySQL Database connected successfully to ${env.dbName}`);
    connection.release();
  } catch (error) {
    logger.error('MySQL Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };
