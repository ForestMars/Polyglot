import { UserSettings } from '@/types/conversation';

export interface AppSettings extends UserSettings {
  // UI Preferences
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  showTimestamps: boolean;
  showModelInfo: boolean;
  // RAG toggle
  enableRAG?: boolean;
  
  // Chat Preferences
  defaultProvider: string;
  defaultModel: string;
  autoSaveInterval: number; // in seconds
  maxConversations: number;
  
  // Advanced Settings
  enableDebugMode: boolean;
  enableAnalytics: boolean;
  backupEnabled: boolean;
  backupInterval: number; // in days
}

export class SettingsService {
  private readonly STORAGE_KEY = 'polyglut_settings';
  private readonly DEFAULT_SETTINGS: AppSettings = {
    // User Settings - No defaults for user choices
    selectedProvider: '',
    selectedModel: '',
    selectedApiKey: '',
    showArchivedChats: false,
    ollamaBaseUrl: 'http://localhost:11434',
    
    // UI Preferences
    theme: 'system',
    sidebarCollapsed: false,
    showTimestamps: true,
    showModelInfo: true,
    
    // Chat Preferences - No defaults for user choices
    defaultProvider: '',
    defaultModel: '',
    autoSaveInterval: 5,
    maxConversations: 100,
    
    // Advanced Settings
    enableDebugMode: false,
    enableAnalytics: false,
    backupEnabled: true,
    backupInterval: 7,
    // RAG default disabled
    enableRAG: false
  };

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<AppSettings> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure all properties exist
        return this.mergeWithDefaults(parsed);
      }
      return { ...this.DEFAULT_SETTINGS };
    } catch (error) {
      console.error('Failed to load settings:', error);
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to storage
   */
  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      const current = await this.loadSettings();
      const updated = { ...current, ...settings };
      
      // Validate settings before saving
      const validated = this.validateSettings(updated);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(validated));
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  /**
   * Update specific setting
   */
  async updateSetting<K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ): Promise<void> {
    const current = await this.loadSettings();
    await this.saveSettings({ ...current, [key]: value });
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      // Return to default state
      await this.loadSettings();
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw new Error('Failed to reset settings');
    }
  }

  /**
   * Export settings as JSON
   */
  async exportSettings(): Promise<string> {
    const settings = await this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  async importSettings(jsonData: string): Promise<void> {
    try {
      const imported = JSON.parse(jsonData);
      
      // Validate imported settings
      if (!this.isValidSettings(imported)) {
        throw new Error('Invalid settings format');
      }
      
      // Merge with current settings to preserve any missing properties
      const current = await this.loadSettings();
      const merged = this.mergeWithDefaults({ ...current, ...imported });
      
      await this.saveSettings(merged);
    } catch (error) {
      console.error('Failed to import settings:', error);
      throw new Error('Failed to import settings');
    }
  }

  /**
   * Get setting value with fallback
   */
  async getSetting<K extends keyof AppSettings>(
    key: K, 
    fallback?: AppSettings[K]
  ): Promise<AppSettings[K]> {
    const settings = await this.loadSettings();
    return settings[key] ?? fallback ?? this.DEFAULT_SETTINGS[key];
  }

  /**
   * Check if setting exists and has a value
   */
  async hasSetting<K extends keyof AppSettings>(key: K): Promise<boolean> {
    const settings = await this.loadSettings();
    const value = settings[key];
    
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return !isNaN(value) && value > 0;
    }
    if (typeof value === 'boolean') {
      return true;
    }
    
    return value !== undefined && value !== null;
  }

  /**
   * Get all settings as a readonly object
   */
  async getAllSettings(): Promise<Readonly<AppSettings>> {
    return await this.loadSettings();
  }

  /**
   * Watch for settings changes
   */
  onSettingsChange(callback: (settings: AppSettings) => void): () => void {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === this.STORAGE_KEY && event.newValue) {
        try {
          const newSettings = JSON.parse(event.newValue);
          callback(this.mergeWithDefaults(newSettings));
        } catch (error) {
          console.error('Failed to parse settings change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }

  /**
   * Validate settings object
   */
  private validateSettings(settings: any): AppSettings {
  const validated: any = { ...this.DEFAULT_SETTINGS };
    
    // Validate each setting with type checking
    for (const [key, defaultValue] of Object.entries(this.DEFAULT_SETTINGS)) {
      if (settings[key] !== undefined) {
        const value = settings[key];
        
        // Type-specific validation
        if (typeof value === typeof defaultValue) {
          if (this.isValidValue(key, value)) {
            // trust runtime validation above, cast to any to satisfy TS
            validated[key as keyof AppSettings] = value as any;
          }
        }
      }
    }
    
    return validated as AppSettings;
  }

  /**
   * Check if a value is valid for a specific setting
   */
  private isValidValue(key: string, value: any): boolean {
    switch (key) {
      case 'theme':
        return ['light', 'dark', 'system'].includes(value);
      case 'autoSaveInterval':
        return typeof value === 'number' && value >= 1 && value <= 60;
      case 'maxConversations':
        return typeof value === 'number' && value >= 10 && value <= 1000;
      case 'backupInterval':
        return typeof value === 'number' && value >= 1 && value <= 365;
      case 'ollamaBaseUrl':
        return typeof value === 'string' && value.trim().length > 0;
      default:
        return true;
    }
  }

  /**
   * Check if settings object is valid
   */
  private isValidSettings(settings: any): boolean {
    return (
      settings &&
      typeof settings === 'object' &&
      typeof settings.selectedProvider === 'string' &&
      typeof settings.selectedModel === 'string'
    );
  }

  /**
   * Merge settings with defaults
   */
  private mergeWithDefaults(settings: Partial<AppSettings>): AppSettings {
    return { ...this.DEFAULT_SETTINGS, ...settings };
  }

  /**
   * Get settings summary for display
   */
  async getSettingsSummary(): Promise<{
    totalSettings: number;
    customizedSettings: number;
    lastModified: Date | null;
  }> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return { totalSettings: 0, customizedSettings: 0, lastModified: null };
      }

      const parsed = JSON.parse(stored);
      const defaults = this.DEFAULT_SETTINGS;
      
      let customizedCount = 0;
      for (const [key, value] of Object.entries(parsed)) {
        if (key in defaults && defaults[key as keyof AppSettings] !== value) {
          customizedCount++;
        }
      }

      return {
        totalSettings: Object.keys(defaults).length,
        customizedSettings: customizedCount,
        lastModified: new Date() // localStorage doesn't provide modification time
      };
    } catch (error) {
      console.error('Failed to get settings summary:', error);
      return { totalSettings: 0, customizedSettings: 0, lastModified: null };
    }
  }
}
