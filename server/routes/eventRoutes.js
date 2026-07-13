const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Public Routes
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);

// Protected Routes (Requires Login)
router.post(
  '/', 
  protect, 
  upload.fields([
    { name: 'banner_image', maxCount: 1 },
    { name: 'additional_images', maxCount: 5 }
  ]), 
  eventController.createEvent
);
router.put(
  '/:id', 
  protect, 
  upload.fields([
    { name: 'banner_image', maxCount: 1 },
    { name: 'additional_images', maxCount: 5 }
  ]), 
  eventController.updateEvent
);
router.delete('/:id', protect, eventController.deleteEvent);

module.exports = router;
