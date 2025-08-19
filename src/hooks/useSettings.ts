import { useState, useEffect, useCallback, useMemo } from 'react';
import { SettingsService, AppSettings } from '@/services/settingsService';

export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create a single instance of SettingsService
  const settingsService = useMemo(() => new SettingsService(), []);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedSettings = await settingsService.loadSettings();
        setSettings(loadedSettings);
      } catch (err) {
        console.error('Failed to load settings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [settingsService]);

  // Save settings
  const saveSettings = useCallback(async (updates: Partial<AppSettings>) => {
    try {
      setError(null);
      await settingsService.saveSettings(updates);
      
      // Update local state
      if (settings) {
        const updatedSettings = { ...settings, ...updates };
        setSettings(updatedSettings);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err;
    }
  }, [settings, settingsService]);

  // Update single setting
  const updateSetting = useCallback(async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    try {
      setError(null);
      await settingsService.updateSetting(key, value);
      
      // Update local state
      if (settings) {
        const updatedSettings = { ...settings, [key]: value };
        setSettings(updatedSettings);
      }
    } catch (err) {
      console.error(`Failed to update setting ${key}:`, err);
      setError(err instanceof Error ? err.message : `Failed to update ${key}`);
      throw err;
    }
  }, [settings, settingsService]);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    try {
      setError(null);
      await settingsService.resetToDefaults();
      
      // Reload settings
      const defaultSettings = await settingsService.loadSettings();
      setSettings(defaultSettings);
    } catch (err) {
      console.error('Failed to reset settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
      throw err;
    }
  }, [settingsService]);

  // Export settings
  const exportSettings = useCallback(async () => {
    try {
      setError(null);
      return await settingsService.exportSettings();
    } catch (err) {
      console.error('Failed to export settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to export settings');
      throw err;
    }
  }, [settingsService]);

  // Import settings
  const importSettings = useCallback(async (jsonData: string) => {
    try {
      setError(null);
      await settingsService.importSettings(jsonData);
      
      // Reload settings
      const importedSettings = await settingsService.loadSettings();
      setSettings(importedSettings);
    } catch (err) {
      console.error('Failed to import settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to import settings');
      throw err;
    }
  }, [settingsService]);

  // Get specific setting value
  const getSetting = useCallback(async <K extends keyof AppSettings>(
    key: K,
    fallback?: AppSettings[K]
  ) => {
    try {
      return await settingsService.getSetting(key, fallback);
    } catch (err) {
      console.error(`Failed to get setting ${key}:`, err);
      return fallback;
    }
  }, [settingsService]);

  // Check if setting exists
  const hasSetting = useCallback(async <K extends keyof AppSettings>(key: K) => {
    try {
      return await settingsService.hasSetting(key);
    } catch (err) {
      console.error(`Failed to check setting ${key}:`, err);
      return false;
    }
  }, [settingsService]);

  // Get settings summary
  const getSettingsSummary = useCallback(async () => {
    try {
      return await settingsService.getSettingsSummary();
    } catch (err) {
      console.error('Failed to get settings summary:', err);
      return {
        totalSettings: 0,
        customizedSettings: 0,
        lastModified: null
      };
    }
  }, [settingsService]);

  // Watch for settings changes
  const watchSettings = useCallback((callback: (settings: AppSettings) => void) => {
    return settingsService.onSettingsChange((newSettings) => {
      setSettings(newSettings);
      callback(newSettings);
    });
  }, [settingsService]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh settings
  const refreshSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const refreshedSettings = await settingsService.loadSettings();
      setSettings(refreshedSettings);
    } catch (err) {
      console.error('Failed to refresh settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh settings');
    } finally {
      setIsLoading(false);
    }
  }, [settingsService]);

  return {
    // State
    settings,
    isLoading,
    error,
    
    // Actions
    saveSettings,
    updateSetting,
    resetToDefaults,
    exportSettings,
    importSettings,
    
    // Utilities
    getSetting,
    hasSetting,
    getSettingsSummary,
    watchSettings,
    clearError,
    refreshSettings,
    
    // Convenience getters for common settings
    selectedProvider: settings?.selectedProvider,
    selectedModel: settings?.selectedModel,
    selectedApiKey: settings?.selectedApiKey,
    showArchivedChats: settings?.showArchivedChats,
    ollamaBaseUrl: settings?.ollamaBaseUrl,
    theme: settings?.theme,
    sidebarCollapsed: settings?.sidebarCollapsed,
    showTimestamps: settings?.showTimestamps,
    showModelInfo: settings?.showModelInfo,
    defaultProvider: settings?.defaultProvider,
    defaultModel: settings?.defaultModel,
    autoSaveInterval: settings?.autoSaveInterval,
    maxConversations: settings?.maxConversations,
    enableDebugMode: settings?.enableDebugMode,
    enableAnalytics: settings?.enableAnalytics,
    backupEnabled: settings?.backupEnabled,
    backupInterval: settings?.backupInterval
  };
};
