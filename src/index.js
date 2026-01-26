import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SessionProvider } from './context/SessionContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <SessionProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SessionProvider>
  </React.StrictMode>
);