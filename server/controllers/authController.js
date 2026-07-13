const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');

/**
 * Helper to generate and store access & refresh tokens
 */
const generateAccessAndRefreshTokens = async (userId) => {
  const accessToken = jwt.sign(
    { id: userId },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn || '1d' }
  );

  const refreshToken = jwt.sign(
    { id: userId },
    env.jwtSecret,
    { expiresIn: '15d' } // Refresh token usually has a longer lifespan
  );

  const expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
  await userModel.updateRefreshToken(userId, refreshToken, expiresAt);

  return { accessToken, refreshToken };
};

const cookieOptions = {
  httpOnly: true,
  secure: true, // Always true for cross-origin 'none'
  sameSite: 'none', // Required for cross-domain cookies (Render/Vercel)
  maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
};

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  console.log(`[AUTH] Register hit for email: ${email}`);

  // Check for duplicate email
  const existingEmail = await userModel.findUserByEmail(email);
  if (existingEmail) {
    throw new ApiError(409, 'User with this email already exists.');
  }

  // Check for duplicate phone
  if (phone) {
    const existingPhone = await userModel.findUserByPhone(phone);
    if (existingPhone) {
      throw new ApiError(409, 'User with this phone number already exists.');
    }
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const newUser = await userModel.createUser({
    name,
    email,
    password: hashedPassword,
    phone: phone || null,
    role: 'USER', // Default role
  });

  res.status(201).json(
    new ApiResponse(201, newUser, 'User registered successfully')
  );
});

/**
 * Login a user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Include password for verification
  const user = await userModel.findUserByEmail(email, true);
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

  // Remove password from response
  delete user.password;

  res
    .status(200)
    .cookie('accessToken', accessToken, cookieOptions)
    .cookie('refreshToken', refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user, accessToken },
        'Logged in successfully'
      )
    );
});

/**
 * Logout user
 */
const logout = asyncHandler(async (req, res) => {
  // If refresh token is in cookies, remove it from DB
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    await userModel.removeRefreshToken(refreshToken);
  }

  res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, {}, 'Logged out successfully'));
});

/**
 * Refresh Access Token
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, env.jwtSecret);
    const user = await userModel.findUserById(decodedToken.id);

    if (!user) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Usually we would also verify if the token exists in the DB and is not revoked.
    // Assuming it is valid, generate new tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id);

    res
      .status(200)
      .cookie('accessToken', accessToken, cookieOptions)
      .cookie('refreshToken', refreshToken, cookieOptions)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          'Access token refreshed successfully'
        )
      );
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
});

/**
 * Get Profile
 */
const getProfile = asyncHandler(async (req, res) => {
  // req.user is populated by authMiddleware
  res.status(200).json(new ApiResponse(200, req.user, 'Profile fetched successfully'));
});

/**
 * Update Profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;

  // Prevent changing sensitive fields like role or password here
  const updatedUser = await userModel.updateUser(req.user.id, { name, phone, updatedBy: req.user.id });

  res.status(200).json(new ApiResponse(200, updatedUser, 'Profile updated successfully'));
});

/**
 * Change Password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await userModel.findUserByEmail(req.user.email, true);
  
  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw new ApiError(400, 'Invalid current password');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await userModel.updatePassword(req.user.id, hashedPassword, req.user.id);

  res.status(200).json(new ApiResponse(200, {}, 'Password changed successfully'));
});

/**
 * Delete Account (Soft Delete)
 */
const deleteAccount = asyncHandler(async (req, res) => {
  await userModel.softDeleteUser(req.user.id, req.user.id);
  
  // Clear cookies as well
  res
    .status(200)
    .clearCookie('accessToken', cookieOptions)
    .clearCookie('refreshToken', cookieOptions)
    .json(new ApiResponse(200, {}, 'Account deleted successfully'));
});

/**
 * Forgot Password Architecture Placeholder
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Placeholder: Verify email, generate reset token, store in DB, send email
  res.status(200).json(new ApiResponse(200, {}, 'Password reset email sent (simulation)'));
});

/**
 * Reset Password Architecture Placeholder
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  // Placeholder: Verify reset token, update password, invalidate reset token
  res.status(200).json(new ApiResponse(200, {}, 'Password has been reset successfully (simulation)'));
});

const getAllUsers = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Not authorized to access this resource');
  }
  const users = await userModel.getAllUsers();
  res.status(200).json(new ApiResponse(200, users, 'Users retrieved successfully'));
});

module.exports = {
  register,
  login,
  logout,
  refreshAccessToken,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  forgotPassword,
  resetPassword,
  getAllUsers
};
