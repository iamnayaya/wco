import { logger } from '../../../lib/logger.js';

/**
 * GeocodingService — address validation, geocoding, and distance calculation.
 *
 * Integrates with Google Maps Geocoding API / Mapbox for address resolution.
 * Falls back to offline heuristics when API is unavailable.
 */

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  confidence: number; // 0-1
}

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  distanceText: string;
  durationText: string;
}

export class GeocodingService {
  /**
   * Geocode an address to coordinates.
   */
  async geocode(address: string): Promise<GeocodeResult | null> {
    if (GOOGLE_MAPS_API_KEY) {
      return this.geocodeGoogle(address);
    }
    if (MAPBOX_API_KEY) {
      return this.geocodeMapbox(address);
    }
    logger.warn('geocoding.no-provider-configured');
    return null;
  }

  /**
   * Reverse geocode coordinates to address.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    if (GOOGLE_MAPS_API_KEY) {
      return this.reverseGeocodeGoogle(latitude, longitude);
    }
    return null;
  }

  /**
   * Calculate distance and duration between two addresses.
   */
  async calculateDistance(
    origin: string,
    destination: string,
  ): Promise<DistanceResult | null> {
    if (GOOGLE_MAPS_API_KEY) {
      return this.distanceGoogle(origin, destination);
    }
    // Offline fallback: estimate based on geocoding both and using haversine
    const [originCoords, destCoords] = await Promise.all([
      this.geocode(origin),
      this.geocode(destination),
    ]);
    if (!originCoords || !destCoords) return null;

    const km = this.haversineDistance(
      originCoords.latitude, originCoords.longitude,
      destCoords.latitude, destCoords.longitude,
    );

    return {
      distanceKm: km,
      durationMinutes: Math.round(km * 3), // rough estimate: 3 min/km in city
      distanceText: `${km.toFixed(1)} km`,
      durationText: `${Math.round(km * 3)} min`,
    };
  }

  /**
   * Validate that an address is properly formatted and resolvable.
   */
  async validateAddress(address: string): Promise<{
    valid: boolean;
    suggestion?: string;
    coordinates?: { latitude: number; longitude: number };
  }> {
    const result = await this.geocode(address);
    if (!result) return { valid: false };

    return {
      valid: result.confidence >= 0.5,
      suggestion: result.formattedAddress !== address ? result.formattedAddress : undefined,
      coordinates: { latitude: result.latitude, longitude: result.longitude },
    };
  }

  // --- Google Maps implementations ---

  private async geocodeGoogle(address: string): Promise<GeocodeResult | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json() as { status: string; results?: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        address_components: Array<{ long_name: string; types: string[] }>;
      }> };

      if (data.status !== 'OK' || !data.results?.length) return null;

      const r = data.results[0];
      const components = r.address_components;
      const getComponent = (type: string) => components.find((c) => c.types.includes(type))?.long_name;

      return {
        latitude: r.geometry.location.lat,
        longitude: r.geometry.location.lng,
        formattedAddress: r.formatted_address,
        city: getComponent('locality') ?? getComponent('sublocality'),
        state: getComponent('administrative_area_level_1'),
        country: getComponent('country'),
        postalCode: getComponent('postal_code'),
        confidence: 0.9,
      };
    } catch (err) {
      logger.error('geocoding.google.error', { error: err });
      return null;
    }
  }

  private async reverseGeocodeGoogle(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json() as { status: string; results?: Array<{ formatted_address: string }> };

      if (data.status !== 'OK' || !data.results?.length) return null;
      return data.results[0].formatted_address;
    } catch (err) {
      logger.error('geocoding.reverse-google.error', { error: err });
      return null;
    }
  }

  private async distanceGoogle(origin: string, destination: string): Promise<DistanceResult | null> {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json() as {
        status: string;
        rows?: Array<{ elements: Array<{
          distance: { value: number; text: string };
          duration: { value: number; text: string };
        }> }>;
      };

      if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) return null;

      const el = data.rows[0].elements[0];
      return {
        distanceKm: Math.round(el.distance.value / 1000 * 10) / 10,
        durationMinutes: Math.round(el.duration.value / 60),
        distanceText: el.distance.text,
        durationText: el.duration.text,
      };
    } catch (err) {
      logger.error('geocoding.distance-google.error', { error: err });
      return null;
    }
  }

  // --- Mapbox implementation ---

  private async geocodeMapbox(address: string): Promise<GeocodeResult | null> {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_API_KEY}&limit=1`;
      const res = await fetch(url);
      const data = await res.json() as { features?: Array<{
        center: [number, number];
        place_name: string;
        context?: Array<{ id: string; text: string }>;
      }> };

      if (!data.features?.length) return null;

      const f = data.features[0];
      const getContext = (type: string) => f.context?.find((c) => c.id.startsWith(type))?.text;

      return {
        latitude: f.center[1],
        longitude: f.center[0],
        formattedAddress: f.place_name,
        city: getContext('place') ?? getContext('neighborhood'),
        state: getContext('region'),
        country: getContext('country'),
        postalCode: getContext('postcode'),
        confidence: 0.8,
      };
    } catch (err) {
      logger.error('geocoding.mapbox.error', { error: err });
      return null;
    }
  }

  // --- Utility ---

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

export const geocodingService = new GeocodingService();
