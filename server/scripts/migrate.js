require('dotenv').config({ path: '../.env' });
const { pool } = require('../config/db');

async function runMigration() {
  try {
    console.log("Running migrations...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS wishlists (
          user_id CHAR(36) NOT NULL,
          event_id CHAR(36) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, event_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    console.log("wishlists table created.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id CHAR(36) NOT NULL,
          event_id CHAR(36) NOT NULL,
          rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
          review TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_event (user_id, event_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    console.log("reviews table created.");

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN is_2fa_enabled BOOLEAN DEFAULT FALSE`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN two_fa_secret VARCHAR(255)`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    try {
      await pool.query(`ALTER TABLE users ADD COLUMN backup_codes JSON`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }

    console.log("users table altered.");
    
    console.log("Migration completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
