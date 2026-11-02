async function request(path, options) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `요청에 실패했습니다 (${response.status})`);
  }
  return body;
}

export const getMenus = (alcohol) => request(`/api/menus?alcohol=${alcohol}`);

export const recordPick = (menuItemId) =>
  request('/api/picks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menuItemId }),
  });

export const getPlaces = ({ keyword, lat, lng, radius }) =>
  request(`/api/places?${new URLSearchParams({ keyword, lat, lng, radius })}`);
