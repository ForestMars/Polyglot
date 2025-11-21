import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '@/components/SettingsPanel';
import { vi } from 'vitest';

const mockProviders = [
  {
    id: 'ollama',
    name: 'Ollama',
    apiKeys: [
      { id: 'key1', name: 'My Key', key: 'sk-1234' }
    ],
    isLocal: true,
    baseUrl: 'http://localhost:11434'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeys: [],
    isLocal: false
  }
];

describe('SettingsPanel', { tags: ['db'] }, () => {
  const defaultProps = {
    providers: mockProviders,
    setProviders: vi.fn(),
    selectedProvider: 'ollama',
    setSelectedProvider: vi.fn(),
    selectedApiKey: 'key1',
    setSelectedApiKey: vi.fn(),
    selectedModel: 'llama3.2',
    setSelectedModel: vi.fn(),
    onClose: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders provider selection', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('Ollama')).toBeInTheDocument();
  });

  it('allows switching providers', () => {
    render(<SettingsPanel {...defaultProps} />);
    const select = screen.getByRole('combobox', { name: /provider/i });
    fireEvent.mouseDown(select);
    const openaiOption = screen.getByText('OpenAI');
    fireEvent.click(openaiOption);
    
    expect(defaultProps.setSelectedProvider).toHaveBeenCalledWith('openai');
  });

  it('shows API key management for non-local providers', () => {
    render(
      <SettingsPanel 
        {...defaultProps} 
        selectedProvider="openai"
        selectedApiKey=""
      />
    );
    expect(screen.getByText('Add Key')).toBeInTheDocument();
  });

  it('hides data transfer section by default', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.queryByText('Export Data')).not.toBeInTheDocument();
  });

  it('shows data transfer section when clicked', async () => {
    render(<SettingsPanel {...defaultProps} />);
    const button = screen.getByText('Data Transfer');
    fireEvent.click(button);
    
    expect(await screen.findByText('Export Data')).toBeInTheDocument();
    expect(screen.getByText('Import Data')).toBeInTheDocument();
  });

  it('displays current model information', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('llama3.2')).toBeInTheDocument();
  });
});
