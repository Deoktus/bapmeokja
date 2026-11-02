// 식당 검색 제공자. 지금은 모의 데이터를 돌려주며, 실제 API(카카오 등)는
// 같은 시그니처의 함수로 바꿔 끼우면 된다. 반환 형태: { source, places }
const NAME_PREFIXES = ['행복', '골목', '오늘', '든든', '푸른', '별빛', '할매', '청춘', '동네', '새벽'];
const NAME_SUFFIXES = ['집', '식당', '네', '하우스', '본점', '키친'];
const EARTH_RADIUS_M = 6371000;

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 같은 입력에는 같은 결과가 나오도록 시드 기반 난수를 쓴다 (mulberry32)
function createRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function searchMockPlaces({ keyword, lat, lng, radius }) {
  const random = createRandom(hashString(`${keyword}|${lat.toFixed(3)}|${lng.toFixed(3)}`));
  const count = 5 + Math.floor(random() * 4);
  const places = [];

  for (let i = 0; i < count; i += 1) {
    const distance = radius * Math.sqrt(random()) * 0.95;
    const bearing = random() * 2 * Math.PI;
    const dLat = (distance * Math.cos(bearing)) / EARTH_RADIUS_M;
    const dLng = (distance * Math.sin(bearing)) / (EARTH_RADIUS_M * Math.cos((lat * Math.PI) / 180));
    const prefix = NAME_PREFIXES[Math.floor(random() * NAME_PREFIXES.length)];
    const suffix = NAME_SUFFIXES[Math.floor(random() * NAME_SUFFIXES.length)];

    places.push({
      id: `mock-${hashString(keyword)}-${i}`,
      name: `${prefix} ${keyword}${suffix}`,
      category: keyword,
      lat: lat + (dLat * 180) / Math.PI,
      lng: lng + (dLng * 180) / Math.PI,
      distanceM: Math.round(distance),
    });
  }

  places.sort((a, b) => a.distanceM - b.distanceM);
  return { source: 'mock', places };
}
