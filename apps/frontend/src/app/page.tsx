export const dynamic = 'force-dynamic';

import {
  Navbar,
  HeroSection,
  ProblemSection,
  SolutionSection,
  FeaturesSection,
  HowItWorksSection,
  BenefitsSection,
  TestimonialsSection,
  CaseStudiesSection,
  PricingSection,
  FAQSection,
  CTASection,
  Footer,
} from '../components/landing';

export const metadata = {
  title:
    'WhatsApp Commerce OS (WCO) — AI-Powered Operating System for WhatsApp Business',
  description:
    'Turn your WhatsApp into a money-making machine. WCO helps informal traders manage products, orders, payments, and deliveries — all powered by AI. Start free today.',
  keywords: [
    'WhatsApp business',
    'WhatsApp commerce',
    'e-commerce Africa',
    'informal trader',
    'AI auto-responder',
    'WhatsApp order management',
    'mobile money payments',
    'WhatsApp business automation',
    'small business OS',
    'emerging markets commerce',
  ],
  openGraph: {
    title: 'WhatsApp Commerce OS — AI-Powered WhatsApp Business Platform',
    description:
      'Manage products, orders, payments, and deliveries on WhatsApp. AI-powered auto-responder handles customers 24/7. Start free.',
    url: 'https://whatsappcommerce.com',
    siteName: 'WhatsApp Commerce OS',
    images: [
      {
        url: 'https://whatsappcommerce.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'WCO — WhatsApp Commerce OS Dashboard',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WhatsApp Commerce OS — AI-Powered WhatsApp Business Platform',
    description:
      'Manage products, orders, payments, and deliveries on WhatsApp. AI-powered auto-responder handles customers 24/7.',
    images: ['https://whatsappcommerce.com/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://whatsappcommerce.com',
  },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'WhatsApp Commerce OS',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'AI-powered operating system for WhatsApp commerce. Manage products, orders, payments, and deliveries.',
  url: 'https://whatsappcommerce.com',
  offers: [
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      name: 'Starter',
      description: 'Free forever plan for solo traders',
    },
    {
      '@type': 'Offer',
      price: '29',
      priceCurrency: 'USD',
      name: 'Growth',
      description: 'For growing businesses ready to scale',
    },
    {
      '@type': 'Offer',
      price: '99',
      priceCurrency: 'USD',
      name: 'Enterprise',
      description: 'For established businesses and teams',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    ratingCount: '2847',
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <FeaturesSection />
        <HowItWorksSection />
        <BenefitsSection />
        <TestimonialsSection />
        <CaseStudiesSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
