import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { SessionProvider } from './context/SessionContext';
import { AuthProvider } from './context/AuthContext';
import { FriendsProvider } from './context/FriendsContext';
import { Amplify } from 'aws-amplify';
import amplifyConfig from './amplifyConfig';

Amplify.configure(amplifyConfig);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <FriendsProvider>
        <SessionProvider>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </SessionProvider>
      </FriendsProvider>
    </AuthProvider>
  </React.StrictMode>
);
