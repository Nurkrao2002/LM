const { query, getClient } = require('../../config/database');
const { ValidationError, ForbiddenError, NotFoundError } = require('../middleware/errorHandler');

// Get user preferences
const getUserPreferences = async (req, res) => {
  try {
    const { category } = req.query;
    const currentUser = req.user;

    let queryParams = [currentUser.id];
    let whereClause = 'WHERE user_id = $1';

    if (category) {
      queryParams.push(category);
      whereClause += ' AND category = $' + queryParams.length;
    }

    const preferences = await query(
      `SELECT category, key, value FROM user_preferences ${whereClause} ORDER BY category, key`,
      queryParams
    );

    // Group preferences by category
    const groupedPreferences = preferences.rows.reduce((acc, pref) => {
      if (!acc[pref.category]) {
        acc[pref.category] = {};
      }
      acc[pref.category][pref.key] = pref.value;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        preferences: groupedPreferences,
        user_id: currentUser.id
      }
    });

  } catch (error) {
    console.error('Get user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user preferences',
      code: 'FETCH_USER_PREFERENCES_ERROR'
    });
  }
};

// Update user preferences
const updateUserPreferences = async (req, res) => {
  try {
    const { category, preferences } = req.body;
    const currentUser = req.user;

    if (!category || !preferences) {
      throw new ValidationError('Category and preferences are required');
    }

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Delete existing preferences for this category
      await client.query(
        'DELETE FROM user_preferences WHERE user_id = $1 AND category = $2',
        [currentUser.id, category]
      );

      // Insert new preferences
      if (Object.keys(preferences).length > 0) {
        const values = [];
        const placeholders = [];
        let paramCount = 1;

        Object.entries(preferences).forEach(([key, value]) => {
          placeholders.push(`($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3})`);
          values.push(currentUser.id, category, key, JSON.stringify(value));
          paramCount += 4;
        });

        const insertQuery = `
          INSERT INTO user_preferences (user_id, category, key, value)
          VALUES ${placeholders.join(', ')}
        `;

        await client.query(insertQuery, values);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `${category} preferences updated successfully`,
        data: {
          category,
          preferences,
          updated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Update user preferences error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update user preferences',
        code: 'UPDATE_USER_PREFERENCES_ERROR'
      });
    }
  }
};

// Get system settings (admin only)
const getSystemSettings = async (req, res) => {
  try {
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      throw new ForbiddenError('Only admins can access system settings');
    }

    const { category } = req.query;
    let whereClause = '';
    let queryParams = [];

    if (category) {
      whereClause = 'WHERE category = $1 AND is_active = true';
      queryParams = [category];
    } else {
      whereClause = 'WHERE is_active = true';
    }

    const settings = await query(
      `SELECT id, key, value, description, category FROM system_settings ${whereClause} ORDER BY category, key`,
      queryParams
    );

    // Group settings by category
    const groupedSettings = settings.rows.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }
      acc[setting.category][setting.key] = {
        id: setting.id,
        value: setting.value,
        description: setting.description
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        settings: groupedSettings,
        categories: Object.keys(groupedSettings),
        total_settings: settings.rows.length
      }
    });

  } catch (error) {
    console.error('Get system settings error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system settings',
        code: 'FETCH_SYSTEM_SETTINGS_ERROR'
      });
    }
  }
};

// Update system settings (admin only)
const updateSystemSetting = async (req, res) => {
  try {
    const { key, value, description, category } = req.body;
    const currentUser = req.user;

    if (currentUser.role !== 'admin') {
      throw new ForbiddenError('Only admins can update system settings');
    }

    if (!key || value === undefined) {
      throw new ValidationError('Key and value are required');
    }

    const result = await query(`
      UPDATE system_settings
      SET value = $1, description = $2, category = $3, updated_at = CURRENT_TIMESTAMP
      WHERE key = $4
      RETURNING id, key, value, description, category, updated_at
    `, [JSON.stringify(value), description || null, category, key]);

    if (result.rows.length === 0) {
      // If setting doesn't exist, create it
      const insertResult = await query(`
        INSERT INTO system_settings (key, value, description, category)
        VALUES ($1, $2, $3, $4)
        RETURNING id, key, value, description, category, updated_at
      `, [key, JSON.stringify(value), description || null, category]);

      res.json({
        success: true,
        message: 'System setting created successfully',
        data: {
          setting: insertResult.rows[0],
          is_new: true
        }
      });
    } else {
      res.json({
        success: true,
        message: 'System setting updated successfully',
        data: {
          setting: result.rows[0],
          is_new: false
        }
      });
    }

  } catch (error) {
    console.error('Update system setting error:', error);
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update system setting',
        code: 'UPDATE_SYSTEM_SETTING_ERROR'
      });
    }
  }
};

// Reset user preferences to defaults
const resetUserPreferences = async (req, res) => {
  try {
    const { category } = req.body;
    const currentUser = req.user;

    if (category) {
      await query(
        'DELETE FROM user_preferences WHERE user_id = $1 AND category = $2',
        [currentUser.id, category]
      );
    } else {
      await query(
        'DELETE FROM user_preferences WHERE user_id = $1',
        [currentUser.id]
      );
    }

    res.json({
      success: true,
      message: category ? `${category} preferences reset to defaults` : 'All preferences reset to defaults',
      data: {
        reset_category: category || 'all',
        reset_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Reset user preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset user preferences',
      code: 'RESET_USER_PREFERENCES_ERROR'
    });
  }
};

module.exports = {
  getUserPreferences,
  updateUserPreferences,
  getSystemSettings,
  updateSystemSetting,
  resetUserPreferences
};