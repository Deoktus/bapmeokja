import express from 'express';
import { searchMockPlaces } from './places.js';

const ALLOWED_RADIUS = [500, 1000, 2000];

const MENUS_SQL = `
  SELECT c.id AS category_id, c.position, c.name AS category_name,
         i.id AS item_id, i.slot, i.name, i.is_alcohol,
         COALESCE(p.pick_count, 0) AS pick_count
  FROM categories c
  JOIN LATERAL (
    SELECT DISTINCT ON (slot) id, slot, name, is_alcohol
    FROM menu_items
    WHERE category_id = c.id AND (is_alcohol = FALSE OR $1::boolean)
    ORDER BY slot, is_alcohol DESC
  ) i ON TRUE
  LEFT JOIN picks p ON p.menu_item_id = i.id
  ORDER BY c.position, i.slot`;

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

export function createApp(pool, searchPlaces = searchMockPlaces) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1kb' }));

  app.get('/api/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.get('/api/menus', async (req, res) => {
    const alcohol = req.query.alcohol === 'true';
    const { rows } = await pool.query(MENUS_SQL, [alcohol]);

    const categories = [];
    for (const row of rows) {
      let category = categories[categories.length - 1];
      if (!category || category.id !== row.category_id) {
        category = { id: row.category_id, position: row.position, name: row.category_name, items: [] };
        categories.push(category);
      }
      category.items.push({
        id: row.item_id,
        slot: row.slot,
        name: row.name,
        isAlcohol: row.is_alcohol,
        pickCount: row.pick_count,
      });
    }
    res.json({ alcohol, categories });
  });

  app.post('/api/picks', async (req, res) => {
    const menuItemId = req.body?.menuItemId;
    if (!Number.isInteger(menuItemId) || menuItemId < 1) {
      return badRequest(res, 'menuItemId는 양의 정수여야 합니다');
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO picks (menu_item_id, pick_count) VALUES ($1, 1)
         ON CONFLICT (menu_item_id) DO UPDATE SET pick_count = picks.pick_count + 1
         RETURNING pick_count`,
        [menuItemId],
      );
      res.json({ menuItemId, pickCount: rows[0].pick_count });
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: '존재하지 않는 메뉴입니다' });
      throw err;
    }
  });

  app.get('/api/places', (req, res) => {
    const keyword = String(req.query.keyword ?? '').trim();
    const toNumber = (value) => (value === undefined || value === '' ? NaN : Number(value));
    const lat = toNumber(req.query.lat);
    const lng = toNumber(req.query.lng);
    const radius = Number(req.query.radius ?? 1000);

    if (keyword.length < 1 || keyword.length > 30) return badRequest(res, 'keyword는 1~30자여야 합니다');
    if (!(Math.abs(lat) <= 90) || !(Math.abs(lng) <= 180)) return badRequest(res, 'lat, lng 값이 올바르지 않습니다');
    if (!ALLOWED_RADIUS.includes(radius)) return badRequest(res, `radius는 ${ALLOWED_RADIUS.join(', ')} 중 하나여야 합니다`);

    res.json(searchPlaces({ keyword, lat, lng, radius }));
  });

  app.use((req, res) => res.status(404).json({ error: '찾을 수 없는 경로입니다' }));

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  });

  return app;
}
