const { pool } = require('./config/db');
const { v4: uuidv4 } = require('uuid');

async function mockSales() {
  const eventId = 'db875aa4-d220-4834-85ce-299119966aa5';
  const price = 149.00;
  const numTickets = 5;

  try {
    const [users] = await pool.query('SELECT id FROM users LIMIT 1');
    const userId = users[0].id;

    console.log(`Creating ${numTickets} bookings for user ${userId} and event ${eventId}...`);

    for (let i = 0; i < numTickets; i++) {
      const bookingId = uuidv4();
      const bookingRef = 'BKG-' + Date.now().toString().slice(-6) + i;
      const ticketNum = 'TIX-' + Date.now().toString().slice(-8) + i;
      const query = `
        INSERT INTO bookings (id, user_id, event_id, number_of_seats, total_amount, status, booking_reference, ticket_number)
        VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)
      `;
      await pool.execute(query, [bookingId, userId, eventId, 1, price, bookingRef, ticketNum]);
    }

    await pool.execute(
      `UPDATE events SET available_seats = available_seats - ? WHERE id = ?`,
      [numTickets, eventId]
    );

    console.log('Successfully created 5 mock tickets!');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

mockSales();
