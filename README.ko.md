# spb-seo-geo

**[English](./README.md)** · 한국어

사이트의 **검색·AI 노출 세팅을 점검하고 자동 구성하는 에이전트 스킬**입니다.
구글 서치콘솔 · 빙 웹마스터 · 네이버 서치어드바이저 + AI 답변 인용(GEO)까지 한 번에 봅니다.

기본은 글로벌이고, **네이버는 국내 사용자도 챙기기 위해** 포함했습니다. 한국을 대상으로 하는 사이트에서만 켜집니다.

```
npx spb-seo-geo     # 설치 — 쓰는 하네스만 골라서, 질문 2개
/spbseo             # 이후 매번 이것만
```

## 무엇이 다른가

| | |
| --- | --- |
| **판정을 코드가 한다** | 에이전트는 사이트 HTML·robots.txt·sitemap 을 읽지 않습니다. 1회 점검에 드는 토큰이 리포트 한 장 값이고, 같은 사이트는 **항상 같은 결과**가 나옵니다. 모델이 바뀌어도 그대로입니다. |
| **네이버를 1급으로 — 단 조건부** | 대부분의 도구가 국내 1위 엔진을 아예 다루지 않습니다. 도메인·한글 비중·`naver-site-verification` 등 7개 신호로 한국 대상을 판별하고, 아니면 네이버 전용 4개만 빼고 33개를 검사합니다. 해외 사이트는 네이버 규칙의 존재로 손해를 보지 않습니다. |
| **근거 없는 규칙은 넣지 않는다** | 37개 규칙 전부에 근거 URL 과 등급(1차 공식문서 / 2차 연구 / 낮음 상관관계)이 붙어 있습니다. 없는 규칙은 로드조차 되지 않습니다. |
| **점수가 없다** | 가중치의 근거를 만들 수 없으니 만들지 않습니다. 통과·경고·실패 개수와 심각도만 보여줍니다. |
| **모르는 건 모른다고 한다** | 확인 못 한 항목(`?`)을 통과로 반올림하지 않고, 조건에 안 맞아 건너뛴 항목(`⏭`)도 숨기지 않습니다. |

## 설치

```bash
npx spb-seo-geo                                     # 대화형
npx spb-seo-geo --agent claude,codex --scope project --yes
npx spb-seo-geo --list-agents
```

- 감지는 하지만 **자동으로 전부 설치하지 않습니다.** 체크는 사용자가 합니다.
- 기본 범위는 **이 프로젝트**입니다. SEO 스킬은 웹 프로젝트에서만 의미가 있으니, 전역에 깔면 무관한 프로젝트에서도 컨텍스트를 차지합니다.
- 여러 하네스를 고르면 실체는 `.agents/skills/spbseo` 한 벌이고 나머지는 심볼릭 링크입니다.
- 설치가 끝나면 **npx·네트워크가 필요하지 않습니다.**

| 하네스 | `/spbseo` |
| --- | --- |
| Claude Code | 스킬 이름이 곧 명령 (파일 불필요) |
| Codex CLI | `~/.codex/prompts/spbseo.md` |
| Gemini CLI | `.gemini/commands/spbseo.toml` |
| Antigravity | `.agent/workflows/spbseo.md` |
| Cursor · Kimi Code · Cline · Warp · Zed 등 | `.agents/skills/` 를 읽습니다 |

## 명령

```bash
node <스킬>/scripts/scan.mjs   --url https://example.kr [--market auto|kr|global] [--verbose] [--json]
node <스킬>/scripts/apply.mjs  --url https://example.kr [--write] [--ai-policy open|cite-only|closed]
node <스킬>/scripts/todo.mjs   --url https://example.kr
node <스킬>/scripts/submit.mjs --url https://example.kr --since HEAD~1
```

보통은 직접 치지 않고 `/spbseo` 로 부릅니다. Node 20+ 가 필요합니다.

- `apply` 는 **기본이 미리보기**입니다. `--write` 없이는 파일이 바뀌지 않고, 기존 파일은 `.bak` 으로 백업하며 `# >>> spb-seo-geo` 경계 주석 안쪽만 수정합니다.
- `submit` 은 IndexNow 로 **Bing·네이버·Yandex·Seznam** 에 알립니다. 구글은 미참여이므로 보낸 척 하지 않습니다.

## 검사 항목 (37개)

| 그룹 | 수 | 내용 |
| --- | --- | --- |
| CORE | 16 | robots.txt · 사이트맵 · canonical · title/description · 초기 HTML 본문 · `lang` 일치 · 오픈그래프 · IndexNow 키 |
| GOOGLE | 7 | 소유확인 · `noindex` · **`nosnippet`** · `Google-Extended` · JSON-LD · Indexing API 오용 |
| NAVER | 4 | 소유확인 · **Yeti 차단** · RSS · 콘솔 등록(확인 불가) — `market=kr` 만 |
| BING | 3 | 소유확인 · bingbot · 등록(GSC import 우회 안내) |
| GEO | 7 | **인용 봇 허용** · 학습 봇 정책 · 사용자 트리거 봇 · 텍스트 형태 · 내부 링크 · 인용 신호 |

가장 자주 걸리는 두 가지:

- **`GEO-01`** — `ClaudeBot`(학습)과 `Claude-SearchBot`(인용)은 별개 토큰입니다. "AI 학습 막아야지" 하다가 인용 봇까지 막으면 **AI 답변에서 통째로 사라집니다.**
- **`GOOGLE-03`** — `nosnippet`·`max-snippet:0` 이 있으면 AI Overviews 인용 자격이 **원천적으로** 없습니다. 구글 공식 문서가 "스니펫과 함께 표시될 자격" 을 전제로 명시합니다.

## `--ai-policy`

| 프리셋 | 학습 봇 | 인용 봇 |
| --- | --- | --- |
| `open` (기본) | 허용 | 허용 |
| `cite-only` | 차단 | 허용 |
| `closed` | 차단 | 차단 — AI 답변에서 사라진다는 경고를 함께 출력 |

기본이 `open` 인 이유: 이 도구의 목표가 노출 최대화입니다. **학습 차단은 가치판단이므로 사용자가 명시적으로 골라야 합니다.**

## 언어

코드·규칙·리포트·`SKILL.md` 는 전부 **영어**입니다. 이 문서만 국문 번역입니다 ([English](./README.md)).

> 리포트 출력도 영어입니다. 국문 출력이 필요하면 이슈로 알려주세요 — `--lang ko` 는 아직 없습니다.

## 개발

```bash
npm test              # 40개
npm run lint:rules    # 근거·등급 없는 규칙을 거부
```

설계 문서와 의사결정 기록(D1~D14)은 `PLAN.md` 와 `../ai-reasearch/10-Projects/08-spb-seo-geo/` 에 있습니다.

## 아직 검증되지 않은 것

- Codex·Antigravity 에서 번들 스크립트 실행 (Claude Code 만 확인)
- 네이버 IndexNow 엔드포인트 실제 응답 (키 파일이 배포된 사이트가 필요)
- 저가 모델(DeepSeek·Kimi 등)이 SKILL.md 지시를 지키는지
- 한글 비중 임계값 20% — 근거 없는 감이고 조정이 필요합니다

## 라이선스

MIT
