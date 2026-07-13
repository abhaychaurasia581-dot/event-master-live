const { pool } = require('./config/db');
require('dotenv').config();

async function test() {
  try {
    const query = `
      SELECT 
        e.id, e.title, e.venue, e.city, e.event_date, e.banner_image,
        AVG(r.rating) as average_rating,
        COUNT(r.id) as total_reviews
      FROM events e
      JOIN reviews r ON e.id = r.event_id
      WHERE e.status IN ('PUBLISHED', 'ACTIVE')
      GROUP BY e.id
      HAVING total_reviews > 0
      ORDER BY average_rating DESC, total_reviews DESC
      LIMIT ?
    `;
    const [rows] = await pool.query(query, [10]);
    console.log('Success:', rows.length);
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    process.exit(0);
  }
}
test();
