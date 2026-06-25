// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { useEffect } from 'react';
import { initializeSync, backgroundSyncWithServer } from './services/backgroundSync';
import { mcpService } from './services/mcpService';

const queryClient = new QueryClient();

const rIC = (cb: () => void) =>
  (window as any).requestIdleCallback
    ? (window as any).requestIdleCallback(cb)
    : setTimeout(cb, 200);

const App = () => {
  useEffect(() => {
    rIC(async () => {
      // Task A: Initialize protocol core (db + clock).
      // Must complete before any sync or write operation.
      try {
        await initializeSync();
        console.log('[startup] Sync initialized');
      } catch (err) {
        console.error('[startup] Failed to initialize sync:', err);
        return;
      }

      // Task B: One-time localStorage migration.
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

      // Task C: Background sync.
      // Protocol layer returns SyncResult — no DOM side effects.
      // Presentation layer (here) decides what to do with it.
      try {
        const result = await backgroundSyncWithServer();
        console.log('[startup] Sync complete:', result);
        if (result.changed) {
          // Notify the state manager to reload. This is the only place
          // 'conversations-updated' is dispatched for sync-triggered reloads.
          window.dispatchEvent(new Event('conversations-updated'));
        }
      } catch (err) {
        console.error('[startup] Sync failed:', err);
      }
    });

    mcpService.initialize().catch(err =>
      console.error('[startup] MCP init failed:', err)
    );
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