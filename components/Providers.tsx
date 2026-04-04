'use client'

import { Toaster } from 'react-hot-toast'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#222423',
            color: '#ffffff',
            border: '1px solid #444',
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
          },
          success: {
            style: {
              background: '#1a3a2e',
              borderColor: '#10b981',
              color: '#10b981',
            },
          },
          error: {
            style: {
              background: '#3a1a1a',
              borderColor: '#ef4444',
              color: '#ef4444',
            },
          },
          loading: {
            style: {
              background: '#3a2a1a',
              borderColor: '#e0521d',
              color: '#e0521d',
            },
          },
        }}
      />
    </>
  )
}
