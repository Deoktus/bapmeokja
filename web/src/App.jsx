import { useCallback, useEffect, useRef, useState } from 'react';
import { getMenus, getPlaces, recordPick } from './api.js';
import Info from './Info.jsx';
import Stage from './Stage.jsx';

const RADIUS_OPTIONS = [500, 1000, 2000];
// 위치 권한이 없을 때 쓰는 기본 위치 (강원도 원주시 부근)
const DEFAULT_LOCATION = { lat: 37.3422, lng: 127.9202, source: 'default' };

// 슬롯 머신: 45ms 간격에서 시작해 14%씩 느려지다가 420ms를 넘으면 결과를 보여 준다 (총 약 3.5초)
const SPIN_START_MS = 45;
const SPIN_END_MS = 420;
const SPIN_SLOWDOWN = 1.14;
const FAST_SPIN_MS = 90;
const PARTICLE_COUNT = 12;

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 8개 항목을 3×3 격자의 가운데를 비우고 배치한 뒤 가운데 칸을 끼워 넣는다
function arrangeGrid(entries, center) {
  return [...entries.slice(0, 4), center, ...entries.slice(4)];
}

// 돌아가는 글자 목록을 미리 만든다. 마지막 칸이 항상 결과이고, 직전 칸과 같은 글자는 연달아 나오지 않는다
function buildSpinPlan(pool, finalItem, reduced) {
  if (reduced) return [{ name: finalItem.name, delay: 0 }];

  const steps = [];
  let previous = null;
  for (let delay = SPIN_START_MS; delay < SPIN_END_MS; delay *= SPIN_SLOWDOWN) {
    let candidate;
    do {
      candidate = pickRandom(pool);
    } while (pool.length > 1 && candidate.name === previous);
    steps.push({ name: candidate.name, delay });
    previous = candidate.name;
  }
  if (pool.length > 1 && previous === finalItem.name) {
    steps[steps.length - 1].name = pool.find((item) => item.name !== finalItem.name).name;
  }
  steps.push({ name: finalItem.name, delay: SPIN_END_MS });
  return steps;
}

function makeParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI + Math.random() * 0.4;
    const distance = 70 + Math.random() * 50;
    return { dx: Math.round(Math.cos(angle) * distance), dy: Math.round(Math.sin(angle) * distance) };
  });
}

function Reel({ spin }) {
  const fast = spin.active && spin.delay < FAST_SPIN_MS;
  return (
    <div className={`reel ${spin.active ? 'spinning' : 'landed'}${fast ? ' fast' : ''}`}>
      <span className="reel-label">{spin.label}</span>
      <div className="reel-window" aria-hidden="true">
        <span key={spin.tick} className="reel-name" style={{ animationDuration: `${Math.min(spin.delay || 1, 160)}ms` }}>
          {spin.name}
        </span>
        {spin.particles?.map((p, i) => (
          <i key={i} className="spark" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px` }}>✦</i>
        ))}
      </div>
      <span className="sr-only">{spin.active ? '메뉴를 뽑는 중입니다' : `${spin.name}(으)로 정해졌습니다`}</span>
    </div>
  );
}

export default function App() {
  const [alcohol, setAlcohol] = useState(false);
  const [radius, setRadius] = useState(1000);
  const [categories, setCategories] = useState([]);
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [selectedId, setSelectedId] = useState(null);
  const [spin, setSpin] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // 진행 중인 뽑기·검색이 취소되었는지 확인하는 번호표 (값이 바뀌면 이전 작업은 결과를 버린다)
  const requestToken = useRef(0);

  const resetOutcome = useCallback(() => {
    requestToken.current += 1;
    setSpin(null);
    setResult(null);
    setSelectedId(null);
    setBusy(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMenus(alcohol)
      .then((data) => {
        if (!cancelled) {
          setCategories(data.categories);
          resetOutcome();
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [alcohol, resetOutcome]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' }),
      () => setLocation(DEFAULT_LOCATION),
      { timeout: 8000 },
    );
  }, []);

  useEffect(requestLocation, [requestLocation]);

  const openCategory = categories.find((c) => c.id === openCategoryId) ?? null;

  const fetchPlaces = (item) =>
    Promise.all([
      getPlaces({ keyword: item.name, lat: location.lat, lng: location.lng, radius }),
      recordPick(item.id),
    ]).then(([places]) => places);

  async function choose(item, scope) {
    const token = ++requestToken.current;
    setBusy(true);
    setError('');
    setSpin(null);
    setResult(null);
    setSelectedId(item.id);
    try {
      const places = await fetchPlaces(item);
      if (token !== requestToken.current) return;
      setResult({ item, scope, via: 'direct', source: places.source, places: places.places, featured: null });
    } catch (err) {
      if (token !== requestToken.current) return;
      setError(err.message);
      setSelectedId(null);
    } finally {
      if (token === requestToken.current) setBusy(false);
    }
  }

  async function randomIn(scopeCategory) {
    const pool = scopeCategory ? scopeCategory.items : categories.flatMap((c) => c.items);
    if (pool.length === 0) return;

    const finalItem = pickRandom(pool);
    const reduced = prefersReducedMotion();
    const label = `${scopeCategory?.name ?? '전체'} 랜덤`;
    const token = ++requestToken.current;

    setBusy(true);
    setError('');
    setResult(null);
    setSelectedId(null);
    setSpin({ active: true, name: '', delay: SPIN_START_MS, tick: 0, label, particles: null });

    // 글자가 도는 동안 서버 요청을 같이 진행하고, 둘 다 끝나면 결과를 보여 준다
    const request = fetchPlaces(finalItem);
    request.catch(() => {});

    try {
      for (const [tick, step] of buildSpinPlan(pool, finalItem, reduced).entries()) {
        if (token !== requestToken.current) return;
        setSpin({ active: true, name: step.name, delay: step.delay, tick, label, particles: null });
        await sleep(step.delay);
      }
      const places = await request;
      if (token !== requestToken.current) return;

      setSpin((current) => ({ ...current, active: false, particles: reduced ? [] : makeParticles() }));
      setSelectedId(finalItem.id);
      setResult({
        item: finalItem,
        scope: scopeCategory,
        via: 'random',
        source: places.source,
        places: places.places,
        featured: places.places.length > 0 ? pickRandom(places.places) : null,
      });
    } catch (err) {
      if (token !== requestToken.current) return;
      setError(err.message);
      setSpin(null);
    } finally {
      if (token === requestToken.current) setBusy(false);
    }
  }

  const spinning = Boolean(spin?.active);

  const menuCell = (item, scope) => (
    <button
      key={item.id}
      className={`cell${item.id === selectedId ? ' selected' : ''}`}
      onClick={() => choose(item, scope)}
      disabled={busy}
    >
      {item.name}
      {item.isAlcohol && <small>주류</small>}
    </button>
  );

  const centerCell = (title, subtitle, onClick, disabled) => (
    <button key="center" className={`cell center${spinning ? ' spinning' : ''}`} onClick={onClick} disabled={disabled}>
      {spinning ? '뽑는 중…' : title}
      {!spinning && <small>{subtitle}</small>}
    </button>
  );

  const cells = openCategory
    ? arrangeGrid(
        openCategory.items.map((item) => menuCell(item, openCategory)),
        centerCell(openCategory.name, '구역 랜덤', () => randomIn(openCategory), busy),
      )
    : arrangeGrid(
        categories.map((category) => (
          <button
            key={category.id}
            className="cell"
            onClick={() => {
              resetOutcome();
              setOpenCategoryId(category.id);
            }}
          >
            {category.name}
          </button>
        )),
        centerCell('밥 뭐먹지?', '전체 랜덤', () => randomIn(null), busy || categories.length === 0),
      );

  return (
    <div className="world">
      <div className="sky" aria-hidden="true" />
      <div className="scroll">
        <main className="app">
          <h1>밥 뭐먹지?</h1>

          <section className="group" aria-label="설정">
            <label className="row">
              <span>술 메뉴 포함</span>
              <input
                type="checkbox"
                role="switch"
                className="ios-switch"
                checked={alcohol}
                onChange={(e) => setAlcohol(e.target.checked)}
              />
            </label>
            <div className="row">
              <span id="radius-label">검색 반경</span>
              <div
                className="segmented"
                role="radiogroup"
                aria-labelledby="radius-label"
                style={{ '--index': RADIUS_OPTIONS.indexOf(radius) }}
              >
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={r === radius}
                    className={r === radius ? 'on' : ''}
                    onClick={() => setRadius(r)}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="row row-button" onClick={requestLocation}>
              <span>위치</span>
              <span className="row-value">
                <svg className="icon-location" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 11.5 21 3l-8.5 18-2-7.5z" />
                </svg>
                {location.source === 'gps' ? '현재 위치' : '원주 (기본)'}
                <svg className="icon-chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </span>
            </button>
          </section>
          <p className="group-note">위치는 식당 검색에만 쓰이고 서버에 저장되지 않습니다.</p>

          {openCategory && (
            <button
              className="link back"
              onClick={() => {
                resetOutcome();
                setOpenCategoryId(null);
              }}
            >
              ← 전체 보기
            </button>
          )}

          <div
            key={openCategoryId ?? 'root'}
            className={`grid${spinning ? ' dimmed' : ''}`}
            role="group"
            aria-label={openCategory ? `${openCategory.name} 메뉴` : '대분류'}
          >
            {cells}
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          {spin && <Reel spin={spin} />}
          {busy && !spin && <p className="status">찾는 중…</p>}

          {result && !busy && (
            <section className="result" aria-live="polite">
              {result.via === 'direct' && <h2>{result.item.name}</h2>}
              {result.via === 'random' && result.featured && (
                <>
                  <p className="place featured">
                    <strong>{result.featured.name}</strong>
                    <span>{result.featured.distanceM}m</span>
                  </p>
                  <button className="reroll" onClick={() => randomIn(result.scope)}>다시 뽑기</button>
                </>
              )}
              {result.via === 'direct' && (
                <ul>
                  {result.places.map((place) => (
                    <li key={place.id} className="place">
                      <strong>{place.name}</strong>
                      <span>{place.distanceM}m</span>
                    </li>
                  ))}
                </ul>
              )}
              {result.source === 'mock' && <p className="notice">샘플 데이터입니다. 실제 식당 정보가 아닙니다.</p>}
            </section>
          )}

          <Info />
        </main>
      </div>
      <Stage />
    </div>
  );
}
