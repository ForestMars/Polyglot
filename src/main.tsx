// src/main.tsx
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { runClientMigrations } from './services/browserMigrations';

// Run client DB migrations before app renders
runClientMigrations().then(() => {
	console.log('[migrations] Client migrations complete');
	startApp();
});

function startApp() {
	// ...existing app startup code...
	createRoot(document.getElementById("root")!).render(<App />);
}
