import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../utils/themeUtils';
import { useSelector, useDispatch } from 'react-redux';
import { selectHasRole, selectCurrentUser } from '../store/slices/authSlice';
import settingsService from '../services/settingsService';
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Globe,
  Lock,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Mail,
  Clock,
  Users,
  Monitor,
  Smartphone,
  Laptop,
  Eye,
  Wifi,
  Database,
  FileText,
  ShieldCheck,
  Zap
} from 'lucide-react';

const Settings = () => {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = useSelector(selectHasRole('admin'));
  const { switchTheme, currentTheme } = useTheme();

  // Settings states with proper data structure
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: false,
    weeklyDigest: true,
    approvalReminders: true,
    replyNotifications: true,
    mentionNotifications: true
  });

  const [systemSettings, setSystemSettings] = useState({
    max_annual_leave_days: 25,
    max_sick_leave_days: 12,
    max_personal_leave_days: 5,
    notice_period_days: 7,
    auto_approval_enabled: false,
    weekend_inclusion: false,
    email_notifications_enabled: true,
    push_notifications_enabled: false,
    weekly_digest_enabled: true
  });

  const [appearance, setAppearance] = useState({
    theme: 'light',
    language: 'en',
    timezone: 'UTC+5:30',
    dateFormat: 'DD/MM/YYYY',
    sidebarPosition: 'left',
    compactMode: false,
    animationsEnabled: true
  });

  // Sync appearance state with current theme
  useEffect(() => {
    setAppearance(prev => ({
      ...prev,
      theme: currentTheme
    }));
  }, [currentTheme]);

  const [security, setSecurity] = useState({
    sessionTimeout: '30',
    twoFactorEnabled: false,
    passwordExpiry: '90',
    loginAlerts: true,
    ipWhitelist: ''
  });

  const [integrations, setIntegrations] = useState({
    slackEnabled: false,
    outlookSync: false,
    googleCalendar: false,
    teamsIntegration: false,
    apiAccess: true
  });

  // UI states
  const [activeSection, setActiveSection] = useState('notifications');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [message, setMessage] = useState('');
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());

  // Load all settings on component mount
  useEffect(() => {
    loadAllSettings();
    return () => {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
    };
  }, [currentUser, isAdmin]);

  const loadAllSettings = async () => {
    try {
      setLoadingData(true);

      // Load user preferences for all categories
      const [userPrefs, systemSettingsRes] = await Promise.allSettled([
        settingsService.getUserPreferences(),
        isAdmin ? settingsService.getSystemSettings() : Promise.resolve({ success: false })
      ]);

      // Handle user preferences
      if (userPrefs.status === 'fulfilled' && userPrefs.value.success) {
        const prefs = userPrefs.value.data.preferences;

        Object.keys(prefs).forEach(category => {
          const prefData = prefs[category];

          switch (category) {
            case 'notifications':
              setNotifications(prev => ({ ...prev, ...prefData }));
              break;
            case 'appearance':
              setAppearance(prev => ({ ...prev, ...prefData }));
              break;
            case 'security':
              setSecurity(prev => ({ ...prev, ...prefData }));
              break;
            case 'integrations':
              setIntegrations(prev => ({ ...prev, ...prefData }));
              break;
          }
        });
      }

      // Handle system settings (admin only)
      if (isAdmin && systemSettingsRes.status === 'fulfilled' && systemSettingsRes.value.success) {
        const settings = systemSettingsRes.value.data.settings;

        if (settings.leave_policy) {
          const newSystemSettings = { ...systemSettings };
          Object.keys(settings.leave_policy).forEach(key => {
            if (newSystemSettings[key] !== undefined) {
              newSystemSettings[key] = settings.leave_policy[key]?.value;
            }
          });
          setSystemSettings(newSystemSettings);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage('❌ Failed to load settings. Please refresh the page.');
    } finally {
      setLoadingData(false);
    }
  };

  // Auto-save functionality
  const scheduleAutoSave = useCallback((category) => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(() => {
      saveSettingsSilently(category);
    }, 2000); // Auto-save after 2 seconds of inactivity
    setAutoSaveTimer(timer);
  }, [autoSaveTimer]);

  // Silent auto-save (no user notification)
  const saveSettingsSilently = async (category) => {
    try {
      let settingsData;
      switch (category) {
        case 'notifications':
          settingsData = notifications;
          break;
        case 'appearance':
          settingsData = appearance;
          break;
        case 'security':
          settingsData = security;
          break;
        case 'integrations':
          settingsData = integrations;
          break;
        default:
          return;
      }

      await settingsService.updateUserPreferences(category, settingsData);
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(category);
        return newSet;
      });
    } catch (error) {
      console.error(`Silent save failed for ${category}:`, error);
    }
  };

  const handleNotificationChange = (field, value) => {
    setNotifications(prev => ({
      ...prev,
      [field]: value
    }));
    setUnsavedChanges(prev => new Set([...prev, 'notifications']));
    scheduleAutoSave('notifications');
  };

  const handleSystemSettingChange = (field, value) => {
    setSystemSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAppearanceChange = (field, value) => {
    // If theme is being changed, apply it immediately
    if (field === 'theme') {
      // Map auto to system preference
      const actualTheme = value === 'auto'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : value;

      switchTheme(actualTheme);
    }

    setAppearance(prev => ({
      ...prev,
      [field]: value
    }));
    setUnsavedChanges(prev => new Set([...prev, 'appearance']));
    scheduleAutoSave('appearance');
  };

  const handleSecurityChange = (field, value) => {
    setSecurity(prev => ({
      ...prev,
      [field]: value
    }));
    setUnsavedChanges(prev => new Set([...prev, 'security']));
    scheduleAutoSave('security');
  };

  const handleIntegrationChange = (field, value) => {
    setIntegrations(prev => ({
      ...prev,
      [field]: value
    }));
    setUnsavedChanges(prev => new Set([...prev, 'integrations']));
    scheduleAutoSave('integrations');
  };

  const saveSettings = async (category, showNotifications = true) => {
    if (loading) return;

    setLoading(true);
    if (showNotifications) setMessage('');

    try {
      let settingsData;
      let response;

      switch (category) {
        case 'notifications':
          settingsData = notifications;
          response = await settingsService.updateUserPreferences('notifications', settingsData);
          break;
        case 'appearance':
          settingsData = appearance;
          response = await settingsService.updateUserPreferences('appearance', settingsData);
          break;
        case 'security':
          settingsData = security;
          response = await settingsService.updateUserPreferences('security', settingsData);
          break;
        case 'integrations':
          settingsData = integrations;
          response = await settingsService.updateUserPermissions('integrations', settingsData);
          break;
        case 'system':
          // Save system settings (admin only)
          if (!isAdmin) {
            throw new Error('Only administrators can update system settings');
          }

          // Save all system settings
          const systemPromises = Object.entries(systemSettings).map(([key, value]) =>
            settingsService.updateSystemSetting(
              key,
              value,
              `System setting for ${key.replace(/_/g, ' ')}`,
              'leave_policy'
            )
          );
          await Promise.all(systemPromises);
          response = { success: true };
          break;
        default:
          return;
      }

      if (response.success) {
        setUnsavedChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(category);
          return newSet;
        });

        if (showNotifications) {
          setMessage(`✅ ${category.charAt(0).toUpperCase() + category.slice(1)} settings saved successfully!`);
        }
      } else {
        throw new Error(response.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error(`Error saving ${category} settings:`, error);
      if (showNotifications) {
        setMessage(`❌ Failed to save ${category} settings. Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveAllSettings = async () => {
    if (loading) return;

    setLoading(true);
    setMessage('');

    const categories = ['notifications', 'appearance'];
    if (isAdmin) categories.push('system');

    try {
      const promises = categories.map(category => saveSettings(category, false));
      await Promise.all(promises);

      setMessage(`✅ All settings saved successfully!`);
      setUnsavedChanges(new Set());
    } catch (error) {
      setMessage('❌ Some settings failed to save. Please try again.');
      console.error('Error saving all settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetToDefault = async (category) => {
    const userConfirmed = window.confirm(`Are you sure you want to reset ${category} settings to defaults?`);
    if (!userConfirmed) return;

    try {
      setLoading(true);

      if (category === 'notifications' || category === 'appearance' || category === 'security' || category === 'integrations') {
        await settingsService.resetUserPreferences(category);

        // Reset local state to defaults
        const defaultValues = {
          notifications: {
            emailNotifications: true,
            pushNotifications: false,
            weeklyDigest: true,
            approvalReminders: true,
            replyNotifications: true,
            mentionNotifications: true
          },
          appearance: {
            theme: 'light',
            language: 'en',
            timezone: 'UTC+5:30',
            dateFormat: 'DD/MM/YYYY',
            sidebarPosition: 'left',
            compactMode: false,
            animationsEnabled: true
          },
          security: {
            sessionTimeout: '30',
            twoFactorEnabled: false,
            passwordExpiry: '90',
            loginAlerts: true,
            ipWhitelist: ''
          },
          integrations: {
            slackEnabled: false,
            outlookSync: false,
            googleCalendar: false,
            teamsIntegration: false,
            apiAccess: true
          }
        };

        if (defaultValues[category]) {
          const setter = {
            'notifications': setNotifications,
            'appearance': setAppearance,
            'security': setSecurity,
            'integrations': setIntegrations
          }[category];

          if (setter) {
            setter(defaultValues[category]);
          }
        }

        setUnsavedChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(category);
          return newSet;
        });
      }

      setMessage(`✅ ${category.charAt(0).toUpperCase() + category.slice(1)} settings reset to defaults.`);
    } catch (error) {
      console.error(`Error resetting ${category} settings:`, error);
      setMessage(`❌ Failed to reset ${category} settings. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white shadow-sm rounded-xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <SettingsIcon className="w-8 h-8 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-1">
                  Personalize your experience and manage system preferences
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {unsavedChanges.size > 0 && (
                <div className="flex items-center text-orange-600">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                  <span className="text-sm">Unsaved changes</span>
                </div>
              )}
              <button
                onClick={saveAllSettings}
                disabled={loading || unsavedChanges.size === 0}
                className="inline-flex items-center px-6 py-3 bg-indigo-600 border border-transparent rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save All
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mb-8 rounded-xl p-4 border-2 ${
            message.includes('✅')
              ? 'bg-green-50 border-green-200'
              : message.includes('❌')
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center">
              {message.includes('✅') ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : message.includes('❌') ? (
                <AlertCircle className="w-6 h-6 text-red-400" />
              ) : (
                <SettingsIcon className="w-6 h-6 text-blue-400" />
              )}
              <p className="ml-3 text-sm font-medium text-gray-800">{message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow-sm rounded-xl p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <Database className="w-5 h-5 mr-2 text-indigo-600" />
                Settings Menu
              </h2>

              <nav className="space-y-2">
                {[
                  { id: 'notifications', icon: Bell, label: 'Notifications', active: activeSection === 'notifications' },
                  { id: 'appearance', icon: Palette, label: 'Appearance', active: activeSection === 'appearance' },
                  ...(isAdmin ? [
                    { id: 'security', icon: Shield, label: 'Security', active: activeSection === 'security' },
                    { id: 'integrations', icon: Wifi, label: 'Integrations', active: activeSection === 'integrations' },
                    { id: 'system', icon: Lock, label: 'System', active: activeSection === 'system' }
                  ] : [])
                ].map(({ id, icon: Icon, label, active }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      active
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {label}
                    {unsavedChanges.has(id) && (
                      <div className="ml-auto w-2 h-2 bg-orange-400 rounded-full"></div>
                    )}
                  </button>
                ))}
              </nav>

              {/* Quick Stats */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={saveAllSettings}
                    disabled={loading || unsavedChanges.size === 0}
                    className="w-full flex items-center px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save All Changes
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            {/* Content Sections */}
            {activeSection === 'notifications' && (
              <div className="bg-white shadow-sm rounded-xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                      <Bell className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
                      <p className="text-gray-600">Manage your notification preferences</p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => saveSettings('notifications')}
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 flex items-center"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </button>
                    <button
                      onClick={() => resetToDefault('notifications')}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive leave request notifications via email', icon: Mail },
                    { key: 'pushNotifications', label: 'Push Notifications', desc: 'Receive browser push notifications for updates', icon: Bell },
                    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of leave activities', icon: Clock },
                    { key: 'approvalReminders', label: 'Approval Reminders', desc: 'Reminders for pending approvals', icon: Users },
                    { key: 'replyNotifications', label: 'Reply Notifications', desc: 'Notifications for replies to your requests', icon: Mail },
                    { key: 'mentionNotifications', label: 'Mention Notifications', desc: 'Notifications when you are mentioned', icon: Users }
                  ].map(({ key, label, desc, icon: Icon }) => (
                    <div key={key} className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-3">
                          <Icon className="w-5 h-5 text-gray-500 mt-0.5" />
                          <div>
                            <h3 className="font-medium text-gray-900">{label}</h3>
                            <p className="text-sm text-gray-500">{desc}</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={notifications[key]}
                            onChange={(e) => handleNotificationChange(key, e.target.checked)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div className="bg-white shadow-sm rounded-xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                      <Palette className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Appearance</h2>
                      <p className="text-gray-600">Customize your interface preferences</p>
                    </div>
                  </div>
                  <button
                    onClick={() => saveSettings('appearance')}
                    disabled={loading}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Theme</label>
                    <select
                      value={appearance.theme}
                      onChange={(e) => handleAppearanceChange('theme', e.target.value)}
                      className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-800 focus:border-indigo-500 dark:focus:border-indigo-400"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto (System)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Language</label>
                    <select
                      value={appearance.language}
                      onChange={(e) => handleAppearanceChange('language', e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="hi">Hindi</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Timezone</label>
                    <select
                      value={appearance.timezone}
                      onChange={(e) => handleAppearanceChange('timezone', e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500"
                    >
                      <option value="UTC+5:30">India (UTC+5:30)</option>
                      <option value="UTC+0">London (UTC+0)</option>
                      <option value="UTC-5">New York (UTC-5)</option>
                      <option value="UTC+8">Singapore (UTC+8)</option>
                      <option value="UTC+9">Tokyo (UTC+9)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Message */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
            <div className="flex items-center">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              <div className="ml-4">
                <h3 className="text-sm font-semibold text-gray-900">Security & Privacy</h3>
                <p className="text-sm text-gray-600 mt-1">
                  All settings are securely stored and encrypted. Changes take effect immediately across all connected devices.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
