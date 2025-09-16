// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useEffect } from 'react';
import { indexedDbStorage } from './services/indexedDbStorage';
import { backgroundSyncWithServer } from './services/backgroundSync';
import { mcpService } from './services/mcpService';

const queryClient = new QueryClient();

const App = () => {
  console.log('App component is running');
  

  // Polyfill for requestIdleCallback
  const rIC = (cb: Function) => (window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 200);

  console.log('App component is running');

  useEffect(() => {
    // 1. Render UI immediately (this component)
    // 2. Schedule background tasks after paint
    rIC(async () => {
      // Task A: Fast load of initial conversations for UI (sidebar, preview)
      try {
        await indexedDbStorage.ready;
        // Example: load top 20 conversations (headers only)
        const items = await indexedDbStorage.listConversations({ limit: 20 });
        // TODO: set into UI store or state for sidebar/preview
        console.log('[startup] Loaded initial conversations:', items.length);
      } catch (err) {
        console.error('[startup] Failed to load initial conversations', err);
      }

      // Task B: One-time localStorage -> IndexedDB migration (if needed)
      try {
        if (typeof indexedDbStorage.migrateFromLocalStorage === 'function') {
          await indexedDbStorage.migrateFromLocalStorage();
          console.log('[startup] Migration from localStorage complete');
        }
      } catch (err) {
        console.error('[startup] Migration from localStorage failed', err);
      }

      // Task C: Background sync with server (non-blocking)
      try {
        await backgroundSyncWithServer();
        console.log('[startup] Background sync with server complete');
      } catch (err) {
        console.error('[startup] Background sync failed', err);
      }
    });

    // Still run MCP service init
    mcpService.initialize().catch((error) => {
      console.error('Failed to initialize MCP service:', error);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;