# spb-seo-geo — 구현 계획

설계 원본: `../ai-reasearch/10-Projects/08-spb-seo-geo/` (D1~D14)
레퍼런스: `../ai-reasearch/20-Library/Dev/검색엔진 · AI 크롤러 레퍼런스.md`

## 지켜야 할 제약 (설계에서 옮겨온 것)

| # | 불변식 |
| --- | --- |
| 1 | 에이전트에 반환되는 건 판정 결과뿐. 원문(HTML·robots·sitemap)은 아니다 |
| 2 | `unknown → pass` 변환 경로가 존재하지 않는다 |
| 3 | `--write` 없이 파일이 변경되지 않는다 |
| 4 | `evidence`·`grade` 없는 규칙은 로드되지 않는다 (린트로 강제) |
| 5 | `grade: 낮음` 은 `critical` 이 될 수 없다 |
| 6 | `# >>> spb-seo-geo` 경계 주석 안쪽만 수정한다 |
| 7 | `market≠kr` → 네이버 전용 4개만 미평가 + **항상 한 줄로 알린다** |
| 7-a | 범용 규칙에 엔진 라벨을 잘못 붙이지 않는다 (IndexNow·OG 는 CORE) |
| 8 | 판정 로직은 한 곳에만. 셸·추론 폴백 없음 |
| 9 | 어떤 모델에서도 같은 리포트가 나온다 |
| 10 | 사용자가 지정하지 않은 위치에 설치하지 않는다 |
| 11 | 설치 후 npm·npx 에 의존하지 않는다 |
| 11-a | 스킬 실체는 하나. 나머지는 심볼릭 링크 |
| 12 | 승인 생략(`// turbo`)은 읽기 전용 명령에만 |

추가 제약: **런타임 의존성 0** (Node 20+ 내장 기능만). 설치 간편성과 직결된다.

## 파일 구조

```
spb-seo-geo/
├── package.json              bin: spb-seo-geo → bin/install.mjs
├── bin/install.mjs           대화형 설치기 (질문 2개)
├── templates/commands/       하네스별 슬래시 커맨드 3줄 템플릿
│   ├── codex.md  gemini.toml  antigravity.md
├── skill/                    ← 설치되는 실체
│   ├── SKILL.md              L1 ≤1,200 토큰
│   ├── references/           L2 (google·naver·bing·geo)
│   ├── rules/catalog.json    37개 · 메타데이터 + 선언적 checker
│   └── scripts/
│       ├── scan.mjs  apply.mjs  todo.mjs  submit.mjs
│       └── lib/
│           ├── args.mjs      인자 파싱 · 종료코드
│           ├── config.mjs    .spb-seo-geo.json
│           ├── http.mjs      fetch + 타임아웃 + 병렬
│           ├── html.mjs      <head> 메타·링크·타이틀·텍스트 추출
│           ├── xml.mjs       sitemap · rss 파싱
│           ├── robots.mjs    robots.txt 파싱 + UA 그룹 매칭
│           ├── collect.mjs   수집 (2단 market 판별 포함)
│           ├── market.mjs    market 판별 7신호
│           ├── rules.mjs     카탈로그 로드 + 린트
│           ├── checkers.mjs  선언적 checker 레지스트리
│           ├── judge.mjs     규칙 × 사실 → findings
│           ├── render.mjs    압축 리포트 / --json
│           ├── framework.mjs 어댑터 (Next·Astro·SvelteKit·정적)
│           └── generate.mjs  robots·sitemap·rss·llms·키파일 생성
└── test/*.test.mjs           robots 매칭 · market 판별 · 렌더 · 카탈로그 린트
```

## 빌드 순서

1. 스캐폴드 + `package.json` + 문서 (README·AGENTS.md)
2. `rules/catalog.json` 37개 — **여기가 제품의 실체**
3. `lib/` 하부부터: args → config → http → html → xml → robots
4. `lib/market.mjs` (2단 판별) → `collect.mjs`
5. `lib/checkers.mjs` → `rules.mjs` → `judge.mjs` → `render.mjs`
6. `scan.mjs`
7. `framework.mjs` → `generate.mjs` → `apply.mjs`
8. `todo.mjs` → `submit.mjs`
9. `SKILL.md` + `references/` 4개 + 커맨드 템플릿
10. `bin/install.mjs`
11. 테스트 + 실사이트 스모크

## 이번에 하지 않는 것

- GSC·Bing OAuth (`status`) · `watch` · npm publish
- Lighthouse · 키워드 리서치 · 백링크
- 점수(score) — 영구 제외
