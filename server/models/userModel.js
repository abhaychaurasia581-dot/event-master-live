const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

/**
 * Helper function to safely omit sensitive fields from user objects
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

const userModel = {
  /**
   * Create a new user
   */
  async createUser(userData) {
    const id = uuidv4();
    const { name, email, password, phone, role = 'USER', createdBy = null } = userData;

    const query = `
      INSERT INTO users (id, name, email, password, phone, role, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await pool.execute(query, [id, name, email, password, phone, role, createdBy]);
    
    return this.findUserById(id);
  },

  /**
   * Find a user by their UUID
   */
  async findUserById(id) {
    const query = `
      SELECT * FROM users 
      WHERE id = ? AND is_deleted = FALSE 
      LIMIT 1
    `;
    
    const [rows] = await pool.execute(query, [id]);
    return sanitizeUser(rows[0] || null);
  },

  /**
   * Find a user by email (Used for login, can optionally return password)
   */
  async findUserByEmail(email, includePassword = false) {
    const query = `
      SELECT * FROM users 
      WHERE email = ? AND is_deleted = FALSE 
      LIMIT 1
    `;
    
    const [rows] = await pool.execute(query, [email]);
    const user = rows[0] || null;
    
    return includePassword ? user : sanitizeUser(user);
  },

  /**
   * Find a user by phone number
   */
  async findUserByPhone(phone) {
    const query = `
      SELECT * FROM users 
      WHERE phone = ? AND is_deleted = FALSE 
      LIMIT 1
    `;
    
    const [rows] = await pool.execute(query, [phone]);
    return sanitizeUser(rows[0] || null);
  },

  /**
   * Update user details
   */
  async updateUser(id, updateData) {
    const { name, phone, updatedBy = null } = updateData;
    
    const query = `
      UPDATE users 
      SET name = COALESCE(?, name), 
          phone = COALESCE(?, phone),
          updated_by = ?
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    await pool.execute(query, [name, phone, updatedBy, id]);
    
    return this.findUserById(id);
  },

  /**
   * Update user password
   */
  async updatePassword(id, hashedPassword, updatedBy = null) {
    const query = `
      UPDATE users 
      SET password = ?, updated_by = ?
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    await pool.execute(query, [hashedPassword, updatedBy, id]);
    return true;
  },

  /**
   * Insert a refresh token for a user
   */
  async updateRefreshToken(userId, token, expiresAt, createdBy = null) {
    const id = uuidv4();
    const query = `
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await pool.execute(query, [id, userId, token, expiresAt, createdBy || userId]);
    return true;
  },

  /**
   * Revoke/remove a refresh token
   */
  async removeRefreshToken(token) {
    const query = `
      UPDATE refresh_tokens 
      SET is_revoked = TRUE 
      WHERE token = ?
    `;
    
    await pool.execute(query, [token]);
    return true;
  },

  /**
   * Soft delete a user
   */
  async softDeleteUser(id, deletedBy = null) {
    const query = `
      UPDATE users 
      SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    await pool.execute(query, [deletedBy, id]);
    return true;
  },

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(id, restoredBy = null) {
    const query = `
      UPDATE users 
      SET is_deleted = FALSE, deleted_at = NULL, updated_by = ?
      WHERE id = ? AND is_deleted = TRUE
    `;
    
    await pool.execute(query, [restoredBy, id]);
    return true;
  },

  /**
   * Get all active users
   */
  async getAllUsers() {
    const query = `
      SELECT id, name, email, phone, role, created_at, updated_at 
      FROM users 
      WHERE is_deleted = FALSE 
      ORDER BY created_at DESC
    `;
    
    const [rows] = await pool.execute(query);
    return rows;
  },

  /**
   * Get users with pagination
   */
  async getUsersWithPagination(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    // Convert to numbers to avoid SQL syntax errors when parameterized in LIMIT
    const limitNum = Number(limit);
    const offsetNum = Number(offset);

    const query = `
      SELECT id, name, email, phone, role, created_at, updated_at 
      FROM users 
      WHERE is_deleted = FALSE 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    // Count total active users
    const countQuery = `SELECT COUNT(*) as total FROM users WHERE is_deleted = FALSE`;
    
    const [rows] = await pool.execute(query, [limitNum, offsetNum]);
    const [countRows] = await pool.execute(countQuery);
    
    return {
      data: rows,
      total: countRows[0].total,
      page: Number(page),
      limit: limitNum,
      totalPages: Math.ceil(countRows[0].total / limitNum)
    };
  },

  /**
   * Search users by name or email
   */
  async searchUsers(searchTerm) {
    const query = `
      SELECT id, name, email, phone, role, created_at, updated_at 
      FROM users 
      WHERE (name LIKE ? OR email LIKE ?) AND is_deleted = FALSE 
      ORDER BY created_at DESC
    `;
    
    const likeTerm = `%${searchTerm}%`;
    const [rows] = await pool.execute(query, [likeTerm, likeTerm]);
    return rows;
  },

  /**
   * Update last login (Proxy: updating the updated_at timestamp since last_login column is absent)
   */
  async updateLastLogin(id) {
    // Note: The schema.sql doesn't have a 'last_login' column, so we just bump updated_at.
    const query = `
      UPDATE users 
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    await pool.execute(query, [id]);
    return true;
  }
};

module.exports = userModel;
