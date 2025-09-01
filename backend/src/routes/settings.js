const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const {
  getUserPreferences,
  updateUserPreferences,
  getSystemSettings,
  updateSystemSetting,
  resetUserPreferences
} = require('../controllers/settingsController');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: errors.array()
    });
  }
  next();
};

// Validation rules
const preferencesValidation = [
  body('category')
    .isIn(['notifications', 'appearance', 'system'])
    .withMessage('Category must be notifications, appearance, or system'),
  body('preferences')
    .isObject()
    .withMessage('Preferences must be an object'),
  handleValidationErrors
];

const systemSettingsValidation = [
  body('key')
    .notEmpty()
    .withMessage('Key is required'),
  body('category')
    .isIn(['leave_policy', 'notifications', 'ui', 'security'])
    .withMessage('Category must be leave_policy, notifications, ui, or security'),
  handleValidationErrors
];

// GET /api/settings/preferences - Get user preferences
router.get('/preferences',
  authenticateToken,
  [
    query('category').optional().isIn(['notifications', 'appearance', 'system']),
    handleValidationErrors
  ],
  asyncHandler(getUserPreferences)
);

// PUT /api/settings/preferences - Update user preferences
router.put('/preferences',
  authenticateToken,
  preferencesValidation,
  asyncHandler(updateUserPreferences)
);

// DELETE /api/settings/preferences - Reset user preferences to defaults
router.delete('/preferences',
  authenticateToken,
  [
    body('category').optional().isIn(['notifications', 'appearance', 'system']),
    handleValidationErrors
  ],
  asyncHandler(resetUserPreferences)
);

// GET /api/settings/system - Get system settings (admin only)
router.get('/system',
  authenticateToken,
  requireRole('admin'),
  [
    query('category').optional().isIn(['leave_policy', 'notifications', 'ui', 'security']),
    handleValidationErrors
  ],
  asyncHandler(getSystemSettings)
);

// PUT /api/settings/system - Update system settings (admin only)
router.put('/system',
  authenticateToken,
  requireRole('admin'),
  systemSettingsValidation,
  asyncHandler(updateSystemSetting)
);

module.exports = router;