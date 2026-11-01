import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { bootstrapAuth } from './auth.js';
import './index.css';

bootstrapAuth().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode><App /></StrictMode>,
  );
});
