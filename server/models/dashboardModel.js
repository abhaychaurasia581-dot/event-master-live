const { pool } = require('../config/db');

const dashboardModel = {
  /**
   * ==========================================
   * ADMIN DASHBOARD ANALYTICS
   * ==========================================
   */
  async getAdminStats() {
    const queries = {
      totalUsers: `SELECT COUNT(*) as count FROM users WHERE role = 'USER' AND is_deleted = FALSE`,
      totalOrganizers: `SELECT COUNT(*) as count FROM users WHERE role = 'ORGANIZER' AND is_deleted = FALSE`,
      totalEvents: `SELECT COUNT(*) as count FROM events WHERE is_deleted = FALSE`,
      activeEvents: `SELECT COUNT(*) as count FROM events WHERE status IN ('UPCOMING', 'ONGOING') AND is_deleted = FALSE`,
      bookingStats: `
        SELECT 
          COUNT(*) as total_bookings,
          SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed_bookings,
          SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_bookings,
          SUM(CASE WHEN status = 'CONFIRMED' THEN total_amount ELSE 0 END) as total_revenue
        FROM bookings WHERE is_deleted = FALSE
      `,
      monthlyRevenue: `
        SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(total_amount) as revenue 
        FROM bookings 
        WHERE status = 'CONFIRMED' AND is_deleted = FALSE AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month 
        ORDER BY month ASC
      `,
      popularCategories: `
        SELECT c.name, COUNT(e.id) as event_count 
        FROM categories c
        LEFT JOIN events e ON c.id = e.category_id AND e.is_deleted = FALSE
        WHERE c.is_deleted = FALSE
        GROUP BY c.id
        ORDER BY event_count DESC
        LIMIT 5
      `,
      topEvents: `
        SELECT e.title, SUM(b.number_of_seats) as tickets_sold, SUM(b.total_amount) as revenue
        FROM events e
        LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'CONFIRMED' AND b.is_deleted = FALSE
        WHERE e.is_deleted = FALSE
        GROUP BY e.id
        ORDER BY tickets_sold DESC
        LIMIT 5
      `
    };

    const [
      [users], [organizers], [events], [activeEvents], [bookings], [monthlyRev], [popCategories], [topEvts]
    ] = await Promise.all([
      pool.execute(queries.totalUsers),
      pool.execute(queries.totalOrganizers),
      pool.execute(queries.totalEvents),
      pool.execute(queries.activeEvents),
      pool.execute(queries.bookingStats),
      pool.execute(queries.monthlyRevenue),
      pool.execute(queries.popularCategories),
      pool.execute(queries.topEvents)
    ]);

    return {
      overview: {
        totalUsers: users[0].count,
        totalOrganizers: organizers[0].count,
        totalEvents: events[0].count,
        activeEvents: activeEvents[0].count,
        totalBookings: bookings[0].total_bookings,
        confirmedBookings: bookings[0].confirmed_bookings,
        cancelledBookings: bookings[0].cancelled_bookings,
        totalRevenue: bookings[0].total_revenue || 0
      },
      charts: {
        monthlyRevenue: monthlyRev,
        popularCategories: popCategories,
        topEvents: topEvts
      }
    };
  },

  /**
   * ==========================================
   * ORGANIZER DASHBOARD ANALYTICS
   * ==========================================
   */
  async getOrganizerStats(organizerId) {
    const queries = {
      eventStats: `
        SELECT 
          COUNT(*) as total_events,
          SUM(CASE WHEN status IN ('UPCOMING', 'ONGOING') THEN 1 ELSE 0 END) as active_events
        FROM events WHERE organizer_id = ? AND is_deleted = FALSE
      `,
      bookingStats: `
        SELECT 
          COUNT(b.id) as total_bookings,
          SUM(b.number_of_seats) as tickets_sold,
          SUM(CASE WHEN b.status = 'CONFIRMED' THEN b.total_amount ELSE 0 END) as total_revenue
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE e.organizer_id = ? AND b.status = 'CONFIRMED' AND b.is_deleted = FALSE
      `,
      monthlyBookings: `
        SELECT DATE_FORMAT(b.created_at, '%Y-%m') as month, COUNT(b.id) as bookings, SUM(b.total_amount) as revenue
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE e.organizer_id = ? AND b.status = 'CONFIRMED' AND b.is_deleted = FALSE AND b.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY month
        ORDER BY month ASC
      `,
      recentActivities: `
        SELECT b.id, b.booking_reference, u.name as user_name, e.title as event_title, b.created_at
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        JOIN users u ON b.user_id = u.id
        WHERE e.organizer_id = ? AND b.is_deleted = FALSE
        ORDER BY b.created_at DESC
        LIMIT 10
      `
    };

    const [
      [events], [bookings], [monthlyBkg], [recentAct]
    ] = await Promise.all([
      pool.execute(queries.eventStats, [organizerId]),
      pool.execute(queries.bookingStats, [organizerId]),
      pool.execute(queries.monthlyBookings, [organizerId]),
      pool.execute(queries.recentActivities, [organizerId])
    ]);

    return {
      overview: {
        totalEvents: events[0].total_events,
        activeEvents: events[0].active_events,
        ticketsSold: bookings[0].tickets_sold || 0,
        totalRevenue: bookings[0].total_revenue || 0
      },
      charts: {
        monthlyBookings: monthlyBkg
      },
      recentActivities: recentAct
    };
  },

  /**
   * ==========================================
   * USER DASHBOARD ANALYTICS
   * ==========================================
   */
  async getUserStats(userId) {
    const queries = {
      bookingStats: `
        SELECT 
          COUNT(*) as total_bookings,
          SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as upcoming_events
        FROM bookings 
        WHERE user_id = ? AND is_deleted = FALSE
      `,
      upcomingEvents: `
        SELECT b.booking_reference, e.title, e.event_date, e.start_time, e.venue
        FROM bookings b
        JOIN events e ON b.event_id = e.id
        WHERE b.user_id = ? AND b.status = 'CONFIRMED' AND e.event_date >= CURDATE() AND b.is_deleted = FALSE
        ORDER BY e.event_date ASC
        LIMIT 5
      `
    };

    const [[bookings], [upcomingEvts]] = await Promise.all([
      pool.execute(queries.bookingStats, [userId]),
      pool.execute(queries.upcomingEvents, [userId])
    ]);

    return {
      overview: {
        totalBookings: bookings[0].total_bookings,
        upcomingEventsCount: bookings[0].upcoming_events
      },
      upcomingEvents: upcomingEvts
    };
  }
};

module.exports = dashboardModel;
