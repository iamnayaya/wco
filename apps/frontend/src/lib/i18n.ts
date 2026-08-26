import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      nav: {
        dashboard: 'Dashboard',
        inbox: 'Inbox',
        orders: 'Orders',
        products: 'Products',
        customers: 'Customers',
        payments: 'Payments',
        deliveries: 'Deliveries',
        marketing: 'Marketing',
        pricing: 'Pricing',
        analytics: 'Analytics',
        stores: 'Stores',
        integrations: 'Integrations',
        settings: 'Settings',
      },
      auth: {
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        forgotPassword: 'Forgot Password',
      },
      dashboard: {
        welcome: 'Welcome back',
        revenueToday: "Today's Revenue",
        ordersToday: "Today's Orders",
        newCustomers: 'New Customers',
        aiResolutionRate: 'AI Resolution Rate',
      },
      common: {
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        create: 'Create',
        search: 'Search',
        loading: 'Loading…',
        noData: 'No data available',
        error: 'An error occurred',
        success: 'Success',
      },
      landing: {
        heroTitle: 'Run your WhatsApp business on autopilot',
        heroSubtitle:
          'AI-powered commerce OS for African merchants. Auto-reply in seconds, accept payments instantly, deliver smarter.',
        heroCta: 'Start Selling',
        featuresTitle: 'Everything you need to sell on WhatsApp',
      },
    },
  },
  ha: {
    translation: {
      nav: { dashboard: 'Fuskar Gida' },
      auth: { login: 'Shiga' },
      common: { save: 'Ajiye', cancel: 'Soke' },
    },
  },
  yo: {
    translation: {
      nav: { dashboard: 'Ojú-ìbòsíṣẹ̀' },
      auth: { login: 'Wọ inú' },
      common: { save: 'Fipamọ́' },
    },
  },
  fr: {
    translation: {
      nav: { dashboard: 'Tableau de bord' },
      auth: { login: 'Connexion' },
      common: { save: 'Enregistrer' },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    lng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'wco-i18n-lang',
    },
  });

export default i18n;

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yorùbà' },
  { code: 'ig', label: 'Igbo' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'Français' },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]['code'];
