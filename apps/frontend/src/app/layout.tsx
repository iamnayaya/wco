import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://whatsappcommerce.com'),
  title: {
    default: 'WCO — WhatsApp Commerce OS',
    template: '%s | WCO',
  },
  description:
    'AI-powered operating system for WhatsApp commerce. Manage products, orders, payments, and deliveries. Built for traders in emerging markets.',
  keywords: [
    'WhatsApp business',
    'WhatsApp commerce',
    'e-commerce Africa',
    'AI auto-responder',
    'informal traders',
    'mobile money',
  ],
  authors: [{ name: 'WCO Team' }],
  creator: 'WhatsApp Commerce OS',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://whatsappcommerce.com',
    siteName: 'WhatsApp Commerce OS',
    title: 'WCO — WhatsApp Commerce OS',
    description:
      'AI-powered operating system for WhatsApp commerce. Manage products, orders, payments, and deliveries.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'WCO Dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WCO — WhatsApp Commerce OS',
    description:
      'AI-powered operating system for WhatsApp commerce.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
