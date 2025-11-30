import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('🚀 main.tsx is executing');
console.log('📍 Current URL:', window.location.href);
console.log('🔍 Checking for root element...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('❌ Root element not found!');
  document.body.innerHTML = '<div style="padding: 40px; font-family: sans-serif;"><h1>Error: Root element not found</h1><p>The #root div is missing from index.html</p></div>';
  throw new Error('Root element not found');
}

console.log('✅ Root element found, creating React root...');

try {
  const root = createRoot(rootElement);
  console.log('✅ React root created, rendering App...');

  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  console.log('✅ App render initiated successfully');
} catch (error) {
  console.error('❌ Error during React initialization:', error);
  document.body.innerHTML = `<div style="padding: 40px; font-family: sans-serif;">
    <h1>React Initialization Error</h1>
    <pre>${error}</pre>
  </div>`;
}
