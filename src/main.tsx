import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'

const el = document.getElementById('root')!
createRoot(el).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <App />
        <Toaster richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
