// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useEffect } from 'react';
import { initializeSync, backgroundSync } from './services/backgroundSync';
import { mcpService } from './services/mcpService';

const queryClient = new QueryClient();

const rIC = (cb: () => void) =>
  (window as any).requestIdleCallback
    ? (window as any).requestIdleCallback(cb)
    : setTimeout(cb, 200);

const App = () => {
  useEffect(() => {
    const startup = async () => {
      // Step 1: Force critical core systems to initialize immediately
      try {
        await initializeSync();
        console.log('[startup] Sync protocol initialized');
        
        // Step 2: Initialize MCP / Ollama bridge now that the DB is ready
        await mcpService.initialize();
        console.log('[startup] MCP initialized');
      } catch (err) {
        console.error('[startup] Critical initialization failed:', err);
        return;
      }

      // Step 3: Defer non-critical network operations and migration until idle
      rIC(async () => {
        // Task B: One-time localStorage migration
        try {
          const raw = localStorage.getItem('polyglot-chats');
          if (raw) {
            const { polyglotDb } = await import('./services/db');
            const chats = JSON.parse(raw);
            for (const chat of chats) await polyglotDb.saveResource(chat);
            localStorage.removeItem('polyglot-chats');
            console.log('[startup] Migrated from localStorage');
          }
        } catch (err) {
          console.error('[startup] Migration failed:', err);
        }

        // Task C: Background sync execution
        try {
          const result = await backgroundSync.syncWithServer(); // Explicit execution route
          console.log('[startup] Sync complete:', result);
          if (result.changed) {
            window.dispatchEvent(new Event('conversations-updated'));
          }
        } catch (err) {
          console.error('[startup] Sync failed:', err);
        }
      });
    };

    startup();
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