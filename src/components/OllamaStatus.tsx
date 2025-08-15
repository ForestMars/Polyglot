import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApiService } from '@/services/api';

interface OllamaStatusProps {
  baseUrl: string;
}

export const OllamaStatus = ({ baseUrl }: OllamaStatusProps) => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const apiService = new ApiService();

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const healthy = await apiService.checkProviderHealth('ollama', baseUrl);
      setIsHealthy(healthy);
      
      if (healthy) {
        // Try to fetch models
        try {
          const response = await fetch(`${baseUrl}/api/tags`);
          if (response.ok) {
            const data = await response.json();
            setModels(data.models?.map((m: any) => m.name) || []);
          }
        } catch (error) {
          console.error('Failed to fetch models:', error);
        }
      }
    } catch (error) {
      setIsHealthy(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, [baseUrl]);

  const getStatusIcon = () => {
    if (isChecking) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (isHealthy) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <XCircle className="w-4 h-4 text-red-500" />;
  };

  const getStatusText = () => {
    if (isChecking) return 'Checking...';
    if (isHealthy) return 'Connected';
    return 'Disconnected';
  };

  const getStatusColor = () => {
    if (isHealthy) return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (isHealthy === false) return 'bg-red-500/10 text-red-600 border-red-500/20';
    return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Server className="w-4 h-4" />
          Ollama Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection:</span>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <Badge variant="outline" className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Base URL:</span>
          <span className="text-xs font-mono text-muted-foreground">{baseUrl}</span>
        </div>

        {isHealthy && models.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Available Models:</span>
            <div className="flex flex-wrap gap-1">
              {models.slice(0, 5).map((model) => (
                <Badge key={model} variant="secondary" className="text-xs">
                  {model}
                </Badge>
              ))}
              {models.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{models.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <Button 
          onClick={checkHealth} 
          variant="outline" 
          size="sm" 
          className="w-full"
          disabled={isChecking}
        >
          {isChecking ? 'Checking...' : 'Refresh Status'}
        </Button>
      </CardContent>
    </Card>
  );
};
