import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { SEED_CATEGORIES } from './seed-data.js';

export function createPool(dbConfig) {
  const pool = new pg.Pool(dbConfig);
  // 쉬고 있는 연결을 DB가 끊으면(재시작 등) 풀이 error 이벤트를 낸다. 받지 않으면 프로세스가 종료되므로
  // 기록만 하고 넘어가면, 풀이 끊어진 연결을 버리고 다음 요청 때 새로 연결한다.
  pool.on('error', (err) => {
    console.error(`DB 유휴 연결 오류: ${err.message}`);
  });
  return pool;
}

// 컨테이너·파드는 DB보다 먼저 뜰 수 있어서 연결될 때까지 재시도한다
export async function waitForDb(pool, { retries = 15, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.log(`DB 연결 대기 중 (${attempt}/${retries}): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// 스키마 생성과 시드 입력은 여러 번 실행해도 결과가 같다
export async function initDb(pool) {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(42)');
    await client.query(schema);

    for (const [index, category] of SEED_CATEGORIES.entries()) {
      const { rows } = await client.query(
        `INSERT INTO categories (position, name) VALUES ($1, $2)
         ON CONFLICT (position) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [index + 1, category.name],
      );
      const categoryId = rows[0].id;

      const items = category.items.map((name, i) => ({ slot: i + 1, name, isAlcohol: false }));
      for (const [slot, name] of Object.entries(category.alcohol)) {
        items.push({ slot: Number(slot), name, isAlcohol: true });
      }
      for (const item of items) {
        await client.query(
          `INSERT INTO menu_items (category_id, slot, name, is_alcohol) VALUES ($1, $2, $3, $4)
           ON CONFLICT (category_id, slot, is_alcohol) DO UPDATE SET name = EXCLUDED.name`,
          [categoryId, item.slot, item.name, item.isAlcohol],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
