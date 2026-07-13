const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

// All dashboard routes require authentication
router.use(protect);

// Admin Dashboard Analytics
router.get('/admin', dashboardController.getAdminDashboard);

// Organizer Dashboard Analytics
router.get('/organizer', dashboardController.getOrganizerDashboard);

// User Dashboard Analytics
router.get('/user', dashboardController.getUserDashboard);

module.exports = router;
