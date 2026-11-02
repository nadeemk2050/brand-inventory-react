import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { MessageBoxProvider } from './context/MessageBoxContext';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <DataProvider>
      <MessageBoxProvider>
        <App />
      </MessageBoxProvider>
    </DataProvider>
  </AuthProvider>,
);
