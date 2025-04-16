// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'       // Main app component
import './index.css'          // Global CSS
import { GoogleOAuthProvider } from '@react-oauth/google' // Google OAuth library

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId="664911476950-vvsp4lnnng7c30gl9ivm0en8rldm2ht8.apps.googleusercontent.com"> {/* Your Google Client ID */}
    <App />                 {/* The App component that contains routes */}
  </GoogleOAuthProvider>
)
