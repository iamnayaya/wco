'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

const toasterStyle: React.CSSProperties = {
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 16px',
  boxShadow:
    '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
};

export function Toaster() {
  return (
    <HotToaster
      position="bottom-center"
      gutter={8}
      toastOptions={{
        duration: 4000,
        style: toasterStyle,
        success: {
          iconTheme: {
            primary: '#059669',
            secondary: '#fff',
          },
        },
        error: {
          iconTheme: {
            primary: '#dc2626',
            secondary: '#fff',
          },
          duration: 6000,
        },
        loading: {
          iconTheme: {
            primary: '#6b7280',
            secondary: '#fff',
          },
        },
      }}
    />
  );
}
