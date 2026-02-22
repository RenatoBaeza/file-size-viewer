import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './renderer/App';
import './App.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
