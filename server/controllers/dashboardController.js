const dashboardModel = require('../models/dashboardModel');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Get Admin Dashboard Stats
 * @route   GET /api/v1/dashboards/admin
 * @access  Private (Admin)
 */
exports.getAdminDashboard = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Admin privileges required.');
  }

  const stats = await dashboardModel.getAdminStats();
  res.status(200).json(new ApiResponse(200, stats, 'Admin dashboard statistics retrieved successfully'));
});

/**
 * @desc    Get Organizer Dashboard Stats
 * @route   GET /api/v1/dashboards/organizer
 * @access  Private (Organizer/Admin)
 */
exports.getOrganizerDashboard = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ORGANIZER' && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Access denied. Organizer privileges required.');
  }

  const stats = await dashboardModel.getOrganizerStats(req.user.id);
  res.status(200).json(new ApiResponse(200, stats, 'Organizer dashboard statistics retrieved successfully'));
});

/**
 * @desc    Get User Dashboard Stats
 * @route   GET /api/v1/dashboards/user
 * @access  Private (User)
 */
exports.getUserDashboard = asyncHandler(async (req, res) => {
  // Any logged-in user can access their own dashboard stats
  const stats = await dashboardModel.getUserStats(req.user.id);
  res.status(200).json(new ApiResponse(200, stats, 'User dashboard statistics retrieved successfully'));
});
