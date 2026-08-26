import type { Config } from 'jest';

/** Mobile unit tests — jest-expo preset. */
export default {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/tests/**/*.spec.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@shopify/.*)',
  ],
} satisfies Config;
