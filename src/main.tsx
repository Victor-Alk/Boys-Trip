import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './App';
import { SessionProvider } from './state/session';
import { EvaluationsProvider } from './state/evaluations';
import { PreferencesProvider } from './state/preferences';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <EvaluationsProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </EvaluationsProvider>
    </SessionProvider>
  </StrictMode>,
);
