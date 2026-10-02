// Smart Reverse Geocoder for Tepic & Xalisco streets
const geocodeCache = new Map<string, string>();

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // 1. Try Photon first (fast, generous CORS and rate limit)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(photonUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const props = data.features[0].properties;
        const street = props.street || props.name;
        const district = props.district || props.suburb || props.city;

        if (street) {
          const formatted = district ? `${street} (${district})` : street;
          geocodeCache.set(cacheKey, formatted);
          return formatted;
        }
      }
    }
  } catch {
    // Failover to Nominatim
  }

  // 2. Failover to OpenStreetMap Nominatim
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'Accept-Language': 'es',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      
      const road = addr.road || addr.pedestrian || addr.footway || addr.cycleway;
      const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential;
      
      if (road) {
        let name = road;
        if (neighbourhood) {
          name += ` (${neighbourhood})`;
        }
        geocodeCache.set(cacheKey, name);
        return name;
      }

      if (data.name) {
        geocodeCache.set(cacheKey, data.name);
        return data.name;
      }
    }
  } catch {
    // Offline or network error
  }

  // Fallback if offline or nothing returned
  const fallback = `Parada (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  return fallback;
}
