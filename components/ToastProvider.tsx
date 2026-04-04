'use client'

import { Toaster } from 'react-hot-toast'

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      toastOptions={{
        duration: 3000,
        style: {
          background: '#222423',
          color: '#ffffff',
          border: '1px solid #444',
          borderRadius: '6px',
          padding: '12px 16px',
          fontSize: '14px',
        },
        success: {
          style: {
            borderColor: '#10b981',
            background: '#1a3a2e',
          },
        },
        error: {
          style: {
            borderColor: '#ef4444',
            background: '#3a1a1a',
          },
        },
        loading: {
          style: {
            borderColor: '#e0521d',
            background: '#3a2a1a',
          },
        },
      }}
    />
  )
}
