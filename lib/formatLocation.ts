/**
 * Zkrácená poloha pro výpisy: místo, město, okres, kraj, stát.
 * Bez ulice, PSČ a městské části.
 */

const COUNTRY_RE =
  /^(česko|czechia|czech republic|slovensko|slovakia|deutschland|germany|österreich|austria|polska|poland|hungary|magyarország)$/i;

function isPostcodeOnly(p: string) {
  return /^\d{3}\s?\d{2}$/.test(p) || /^\d{5}$/.test(p);
}

/** „110 00 Praha“ → „Praha“ */
function cityFromPostcodePart(p: string): string | null {
  const m = p.match(/^\d{3}\s?\d{2}\s+(.+)$/);
  return m?.[1]?.trim() || null;
}

function isHouseNumberOnly(p: string) {
  return /^\d+[a-zA-Z]?([/-]\d+[a-zA-Z]?)?$/.test(p);
}

/** Ulice s číslem popisným / orientačním */
function isStreetWithNumber(p: string) {
  if (COUNTRY_RE.test(p) || /^okres\b/i.test(p)) return false;
  if (/\bkraj\b/i.test(p)) return false;
  return (
    isHouseNumberOnly(p) ||
    /\s+\d+[a-zA-Z]?([/-]\d+[a-zA-Z]?)?$/.test(p)
  );
}

/** Praha 6, Brno-město číslované městské části */
function isCityDistrict(p: string) {
  if (/^městská část\b/i.test(p)) return true;
  if (/^(praha|brno)\s+\d+/i.test(p)) return true;
  return false;
}

function pushUnique(out: string[], value: string) {
  if (!value) return;
  if (out.some((x) => x.toLowerCase() === value.toLowerCase())) return;
  out.push(value);
}

/**
 * Z Nominatim `address` (+ volitelný název POI) sestaví krátký řetězec.
 */
export function formatLocationFromNominatim(
  address?: Record<string, string> | null,
  name?: string | null
): string {
  const a = address || {};

  const place =
    (name || '').trim() ||
    [a.amenity, a.shop, a.tourism, a.leisure, a.building, a.office, a.club]
      .filter(Boolean)[0] ||
    '';

  const city =
    a.city || a.town || a.village || a.municipality || a.hamlet || '';

  const okresRaw =
    a.county || a.state_district || (a.district && !isCityDistrict(a.district) ? a.district : '') || '';

  const kraj = a.state || '';
  const country = a.country || '';

  const out: string[] = [];
  if (place && place.toLowerCase() !== city.toLowerCase()) {
    // Neukládej ulici jako „místo“
    if (!isStreetWithNumber(place)) pushUnique(out, place);
  }
  if (city) pushUnique(out, city);

  if (okresRaw) {
    const okres =
      /^okres\b/i.test(okresRaw) || okresRaw.toLowerCase() === city.toLowerCase()
        ? okresRaw
        : `okres ${okresRaw}`;
    if (okres.toLowerCase() !== city.toLowerCase()) pushUnique(out, okres);
  }

  if (kraj && kraj.toLowerCase() !== city.toLowerCase()) {
    pushUnique(out, kraj);
  }
  if (country) pushUnique(out, country);

  return out.join(', ');
}

/**
 * Z uloženého display_name / textu odvodí stejný krátký formát.
 */
export function formatShortLocation(poloha?: string | null): string {
  if (!poloha?.trim()) return '';

  const parts = poloha
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) return parts[0] || '';

  const filtered: string[] = [];
  for (const p of parts) {
    if (isPostcodeOnly(p)) continue;
    if (isStreetWithNumber(p)) continue;
    if (isCityDistrict(p)) continue;

    const city = cityFromPostcodePart(p);
    if (city) {
      pushUnique(filtered, city);
      continue;
    }
    pushUnique(filtered, p);
  }

  if (filtered.length === 0) return parts[0];
  if (filtered.length <= 5) return filtered.join(', ');

  // Při přebytku: první (místo) + poslední 4 (město…stát), ať kraj/stát nezmizí
  const head = filtered[0];
  const tail = filtered.slice(-4);
  const merged: string[] = [];
  pushUnique(merged, head);
  for (const t of tail) pushUnique(merged, t);
  return merged.join(', ');
}
