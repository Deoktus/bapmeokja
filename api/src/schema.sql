CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  position SMALLINT NOT NULL UNIQUE CHECK (position BETWEEN 1 AND 8),
  name TEXT NOT NULL
);

-- 한 칸(slot)에 기본 메뉴(is_alcohol=false)와 술 포함 모드용 대체 메뉴(is_alcohol=true)를 둘 수 있다
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 8),
  name TEXT NOT NULL,
  is_alcohol BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (category_id, slot, is_alcohol)
);

-- 익명 선택 횟수만 저장한다 (사용자·위치 정보 없음)
CREATE TABLE IF NOT EXISTS picks (
  menu_item_id INT PRIMARY KEY REFERENCES menu_items(id) ON DELETE CASCADE,
  pick_count INT NOT NULL DEFAULT 0
);
