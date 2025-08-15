import { useState } from 'react';
import { X, Plus, Trash2, Key, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { Provider } from './ChatInterface';
import { OllamaStatus } from './OllamaStatus';

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
  const { toast } = useToast();

  const currentProvider = providers.find(p => p.id === selectedProvider);
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

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  };

  return (
    <div className="w-96 glass-panel border-l h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          <h2 className="font-semibold">Settings</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Provider Selection */}
        <div className="space-y-3">
          <Label>AI Provider</Label>
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

        {/* API Key Selection - Only show for non-local providers */}
        {selectedProvider && !currentProvider?.isLocal && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>API Key</Label>
              <Dialog open={showAddKeyDialog} onOpenChange={setShowAddKeyDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedProviderForKey(selectedProvider)}
                    className="text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Key
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel">
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
            </div>
            
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
                          <Trash2 className="w-4 h-4" />
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
      </div>
    </div>
  );
};