import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distanceMeters, searchMockPlaces } from '../src/places.js';
import { SEED_CATEGORIES } from '../src/seed-data.js';

const ORIGIN = { lat: 37.3422, lng: 127.9202 };

test('모의 검색 결과는 반경 안에 있고 보고된 거리와 좌표가 일치한다', () => {
  for (const radius of [500, 1000, 2000]) {
    const { source, places } = searchMockPlaces({ keyword: '라멘', ...ORIGIN, radius });
    assert.equal(source, 'mock');
    assert.ok(places.length >= 5 && places.length <= 8);
    for (const place of places) {
      assert.ok(place.distanceM <= radius);
      const actual = distanceMeters(ORIGIN.lat, ORIGIN.lng, place.lat, place.lng);
      assert.ok(Math.abs(actual - place.distanceM) < 5, `${actual} vs ${place.distanceM}`);
    }
  }
});

test('같은 입력은 같은 결과를 내고 거리순으로 정렬된다', () => {
  const input = { keyword: '떡볶이', ...ORIGIN, radius: 1000 };
  const first = searchMockPlaces(input);
  assert.deepEqual(first, searchMockPlaces(input));
  const distances = first.places.map((p) => p.distanceM);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
});

test('시드 데이터는 8개 대분류 × 8칸이고 술 대체 메뉴는 유효한 칸을 가리킨다', () => {
  assert.equal(SEED_CATEGORIES.length, 8);
  for (const category of SEED_CATEGORIES) {
    assert.equal(category.items.length, 8, category.name);
    for (const slot of Object.keys(category.alcohol)) {
      assert.ok(Number(slot) >= 1 && Number(slot) <= 8, `${category.name} 슬롯 ${slot}`);
    }
  }
  const names = SEED_CATEGORIES.flatMap((c) => [...c.items, ...Object.values(c.alcohol)]);
  assert.equal(new Set(names).size, names.length, '메뉴 이름이 중복됨');
});
