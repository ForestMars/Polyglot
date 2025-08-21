import { useState, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Key, Settings as SettingsIcon, Download, Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConversationState } from '@/hooks/useConversationState';
import type { Provider } from './ChatInterface';
import { OllamaStatus } from './OllamaStatus';
import { StorageService } from '@/services/storage';

// Create a single instance of StorageService
const storageService = new StorageService();

interface SettingsPanelProps {
  providers: Provider[];
  setProviders: (providers: Provider[]) => void;
  selectedProvider: string;
  setSelectedProvider: (provider: string) => void;
  selectedApiKey: string;
  setSelectedApiKey: (keyId: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onClose: () => void;
}

export const SettingsPanel = ({
  providers,
  setProviders,
  selectedProvider,
  setSelectedProvider,
  selectedApiKey,
  setSelectedApiKey,
  selectedModel,
  setSelectedModel,
  onClose
}: SettingsPanelProps) => {
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [showAddKeyDialog, setShowAddKeyDialog] = useState(false);
  const [selectedProviderForKey, setSelectedProviderForKey] = useState('');
  const [showArchivedChats, setShowArchivedChats] = useState(false);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDataTransfer, setShowDataTransfer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const conversationState = useConversationState();

  const currentProvider = useMemo(() => 
    providers.find(p => p.id === selectedProvider),
    [providers, selectedProvider]
  );
  const currentApiKey = currentProvider?.apiKeys.find(k => k.id === selectedApiKey);

  const handleAddApiKey = () => {
    if (!newKeyName.trim() || !newKeyValue.trim() || !selectedProviderForKey) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    const updatedProviders = providers.map(provider => {
      if (provider.id === selectedProviderForKey) {
        const newKey = {
          id: Date.now().toString(),
          name: newKeyName.trim(),
          key: newKeyValue.trim()
        };
        return {
          ...provider,
          apiKeys: [...provider.apiKeys, newKey]
        };
      }
      return provider;
    });

    setProviders(updatedProviders);
    setNewKeyName('');
    setNewKeyValue('');
    setSelectedProviderForKey('');
    setShowAddKeyDialog(false);
    
    toast({
      title: "API Key Added",
      description: `Successfully added API key "${newKeyName}" to ${providers.find(p => p.id === selectedProviderForKey)?.name}.`
    });
  };

  const handleDeleteApiKey = (providerId: string, keyId: string) => {
    const updatedProviders = providers.map(provider => {
      if (provider.id === providerId) {
        return {
          ...provider,
          apiKeys: provider.apiKeys.filter(key => key.id !== keyId)
        };
      }
      return provider;
    });

    setProviders(updatedProviders);
    
    // Reset selection if deleted key was selected
    if (selectedApiKey === keyId) {
      setSelectedApiKey('');
    }

    toast({
      title: "API Key Deleted",
      description: "API key has been successfully removed."
    });
  };

  const handleDeleteProvider = (providerId: string) => {
    setProviders(providers.filter(p => p.id !== providerId));
    if (selectedProvider === providerId) {
      setSelectedProvider('');
      setSelectedModel('');
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await storageService.exportToFiles();
      toast({
        title: "Export Successful",
        description: "Your data has been exported as downloadable files. Save them to your data/ directory.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    try {
      await storageService.importFromFiles(files);
      toast({
        title: "Import Successful",
        description: "Your data has been imported successfully. The page will refresh to apply changes.",
      });
      // Refresh the page to apply imported settings
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import data. Please check your files and try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  };

  return (
    <div className="w-96 max-h-[80vh] glass-panel rounded-lg shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Settings</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="showArchived">Show Archived Chats</Label>
              <input
                id="showArchived"
                type="checkbox"
                checked={showArchivedChats}
                onChange={(e) => setShowArchivedChats(e.target.checked)}
                className="rounded border-gray-300"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="cacheToggle">Enable Conversation Cache</Label>
              <input
                id="cacheToggle"
                type="checkbox"
                checked={conversationState.isCacheEnabled?.() ?? true}
                onChange={(e) => conversationState.toggleCache?.()}
                className="rounded border-gray-300"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ollamaUrl">Ollama Base URL</Label>
              <Input
                id="ollamaUrl"
                value={ollamaBaseUrl}
                onChange={(e) => setOllamaBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
          </CardContent>
        </Card>


        {/* Provider Selection */}
        <div className="space-y-3">
          <Label>Provider</Label>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="glass-panel">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {providers.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API Key Management - Only show for non-local providers */}
        {selectedProvider && !currentProvider?.isLocal && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>API Keys</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddKeyDialog(true)}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Key
              </Button>
            </div>

            {/* Add API Key Dialog */}
            <Dialog open={showAddKeyDialog} onOpenChange={setShowAddKeyDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add API Key</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={selectedProviderForKey} onValueChange={setSelectedProviderForKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map(provider => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g., Personal Key, Client A"
                      className="glass-panel"
                    />
                  </div>
                  <div>
                    <Label htmlFor="keyValue">API Key</Label>
                    <Input
                      id="keyValue"
                      type="password"
                      value={newKeyValue}
                      onChange={(e) => setNewKeyValue(e.target.value)}
                      placeholder="sk-..."
                      className="glass-panel"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddApiKey} className="flex-1">
                      Add Key
                    </Button>
                    <Button variant="outline" onClick={() => setShowAddKeyDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            {currentProvider?.apiKeys.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No API keys configured</p>
                <p className="text-xs">Add a key to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentProvider?.apiKeys.map(apiKey => (
                  <Card key={apiKey.id} className={`glass-panel cursor-pointer transition-all ${
                    selectedApiKey === apiKey.id ? 'ring-2 ring-primary' : ''
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedApiKey(apiKey.id)}
                        >
                          <p className="font-medium text-sm">{apiKey.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {maskApiKey(apiKey.key)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteApiKey(selectedProvider, apiKey.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ollama Configuration - Only show for Ollama */}
        {selectedProvider && currentProvider?.isLocal && (
          <div className="space-y-3">
            <Label>Ollama Configuration</Label>
            <div className="space-y-2">
              <div>
                <Label htmlFor="baseUrl" className="text-sm">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={currentProvider.baseUrl || 'http://localhost:11434'}
                  onChange={(e) => {
                    const updatedProviders = providers.map(p => 
                      p.id === selectedProvider 
                        ? { ...p, baseUrl: e.target.value }
                        : p
                    );
                    setProviders(updatedProviders);
                  }}
                  placeholder="http://localhost:11434"
                  className="glass-panel"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL where Ollama is running (default: http://localhost:11434)
                </p>
              </div>
              
              {/* Ollama Status Component */}
              <OllamaStatus baseUrl={currentProvider.baseUrl || 'http://localhost:11434'} />
            </div>
          </div>
        )}

        {/* Model Selection */}
        {selectedProvider && (currentProvider?.isLocal || selectedApiKey) && (
          <div className="space-y-3">
            <Label>Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="glass-panel">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {currentProvider?.models.map(model => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Current Configuration Summary */}
        {selectedProvider && selectedModel && (currentProvider?.isLocal || selectedApiKey) && (
          <Card className="glass-panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider:</span>
                <span>{currentProvider?.name}</span>
              </div>
              {!currentProvider?.isLocal && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Key:</span>
                  <span>{currentApiKey?.name}</span>
                </div>
              )}
              {currentProvider?.isLocal && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base URL:</span>
                  <span className="text-xs font-mono">{currentProvider.baseUrl}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model:</span>
                <span>{selectedModel}</span>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Data Transfer Section - Collapsible */}
        <div className="pt-4 border-t mt-4">
          <button 
            onClick={() => setShowDataTransfer(!showDataTransfer)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            Data Transfer
            <span className="ml-auto text-xs">{showDataTransfer ? '▲' : '▼'}</span>
          </button>
          
          {showDataTransfer && (
            <div className="mt-2 space-y-4 pl-6">
              <div className="space-y-2">
                <Label className="text-sm">Export your data to transfer between browsers</Label>
                <Button 
                  onClick={handleExportData} 
                  disabled={isExporting}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Downloads conversations.json, settings.json, and storage-index.json
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Import data from another browser</Label>
                <Button 
                  onClick={triggerFileUpload} 
                  disabled={isImporting}
                  className="w-full"
                  variant="outline"
                  size="sm"
                >
                  <Upload className="h-3.5 w-3.5 mr-2" />
                  {isImporting ? 'Importing...' : 'Import Data'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json"
                  onChange={handleImportData}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground">
                  Select the exported JSON files to restore your data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};