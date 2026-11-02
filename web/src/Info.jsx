// 하단에 보여 주는 정보는 모두 화면 구성을 위한 샘플 데이터다
const TOP_MENUS = [
  { name: '마라탕', count: 312 },
  { name: '떡볶이', count: 287 },
  { name: '치킨', count: 254 },
  { name: '돈카츠', count: 198 },
  { name: '쌀국수', count: 173 },
];

const STATS = [
  { label: '오늘 뽑은 횟수', value: '1,284' },
  { label: '등록된 메뉴', value: '64' },
  { label: '평균 검색 반경', value: '1.2km' },
];

const MAX_COUNT = Math.max(...TOP_MENUS.map((menu) => menu.count));

export default function Info() {
  return (
    <footer className="info">
      <div className="stats">
        {STATS.map((stat) => (
          <div key={stat.label} className="stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>

      <h3 className="group-title">이번 주 인기 메뉴</h3>
      <ol className="group ranking">
        {TOP_MENUS.map((menu, index) => (
          <li key={menu.name} className="row">
            <span className="rank">{index + 1}</span>
            <span className="rank-name">{menu.name}</span>
            <span className="rank-bar" aria-hidden="true">
              <i style={{ width: `${(menu.count / MAX_COUNT) * 100}%` }} />
            </span>
            <span className="rank-count">{menu.count}회</span>
          </li>
        ))}
      </ol>

      <h3 className="group-title">만든 사람</h3>
      <div className="group">
        <div className="row maker">
          <span className="avatar">
            <img src="/maker.png" alt="만든 사람 Liam의 프로필 사진" width="44" height="44" />
          </span>
          <span className="maker-text">
            <strong>Liam</strong>
            <span>개인 프로젝트 · 배포 실습용</span>
          </span>
        </div>
        <div className="row">
          <span>버전</span>
          <span className="row-value">v0.1.0</span>
        </div>
      </div>

      <p className="group-note">이 영역의 수치는 샘플 데이터입니다.</p>
    </footer>
  );
}
