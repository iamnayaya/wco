type EventParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    mixpanel?: { track: (event: string, props?: EventParams) => void };
  }
}

export function trackEvent(name: string, params?: EventParams) {
  if (typeof window === 'undefined') return;

  // Google Analytics 4
  window.gtag?.('event', name, params);

  // Facebook Pixel
  window.fbq?.('trackCustom', name, params);

  // Mixpanel
  window.mixpanel?.track(name, params);
}

export function trackPageView(url: string) {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'page_view', { page_path: url });
}

export function trackCTAClick(location: string) {
  trackEvent('cta_click', { location });
}

export function trackSignup(method: string) {
  trackEvent('sign_up', { method });
}

export function trackPricingView(plan: string) {
  trackEvent('view_item', { item_name: plan });
}
