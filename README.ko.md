# spb-seo-geo

**[English](./README.md)** · 한국어

사이트의 **검색·AI 노출 세팅을 점검하고 자동 구성하는 에이전트 스킬**입니다.
구글 서치콘솔 · 빙 웹마스터 · 네이버 서치어드바이저 · Yahoo! JAPAN + AI 답변 인용(GEO)까지 한 번에 봅니다.

추론할 수 없는 것 — 사이트 URL, **네이버·Yahoo 를 추가할지**, 콘솔 소유확인 토큰 — 을 **처음에 한 번 받고**, 그 답을 기준으로 전부 세팅한 뒤, 정말로 사람이 해야 하는 것만 넘겨줍니다.

```
npx spb-seo-geo     # 설치 — 쓰는 하네스만 골라서, 질문 2개
/spbseo             # 전체 점검
/spbseo seo         # 검색만
/spbseo geo         # AI 인용만
```

첫 실행에서는 짧은 인테이크를 **하나씩** 물어봅니다 — 사이트 주소(대개 프로젝트에서 이미 찾아내므로 확인만 하면 됩니다), 네이버·Yahoo 를 챌지, AI 학습 정책, 가지고 있는 소유확인 토큰, 액세스 로그. 모든 답은 `.spb-seo-geo.json` 에 저장되어 **이후 실행은 플래그가 필요 없습니다.**

## 무엇이 다른가

| | |
| --- | --- |
| **판정을 코드가 한다** | 에이전트는 사이트 HTML·robots.txt·sitemap 을 읽지 않습니다. 1회 점검에 드는 토큰이 리포트 한 장 값이고, 같은 사이트는 **항상 같은 결과**가 나옵니다. 모델이 바뀌어도 그대로입니다. |
| **목록만 주지 않고 끝까지 합니다** | 소유확인 토큰을 처음에 받아두면 태그까지 넣어줍니다. "직접 넣으세요" 로 떠넘기지 않습니다. `<head>` 를 프레임워크가 소유하는 경우엔 **붙여넣을 수 있는 형태**로 줍니다 — Next.js 면 생 `<meta>` 가 아니라 `metadata.verification` 객체. |
| **선택 작업은 선택이고, 실패가 아닙니다** | 모든 규칙은 모든 사이트에서 돕니다. 지역 크롤러를 허용하는 건 어디서나 공짜니까요. 콘솔 계정이 필요한 작업만 지역용이고, 그건 `todo` 의 "선택" 항목으로 갑니다 — 한국을 안 노리는 사이트에 **네이버 실패가 뜨는 일이 없습니다.** 신호(`한글 100%`, `.jp 도메인`)는 게이트가 아니라 넛지입니다. |
| **Yahoo 는 사실대로 설명합니다** | Yahoo 는 자체 인덱스가 없습니다. **Yahoo! JAPAN 은 구글 인덱스**, 그 외 Yahoo 는 **빙**입니다. 즉 "Yahoo 최적화" 라는 작업은 존재하지 않고, Yahoo 규칙 그룹을 만들면 근거 없는 규칙이 됩니다. 일본은 실제 검사 1개(Yahoo! JAPAN 자체 크롤러 `Y!J-*`)와 구글 결과를 가리키는 안내 1개만 추가합니다. |
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

## 검사 항목 (44개)

41개는 어느 사이트에나 적용되는 판정이고, 나머지 3개는 네이버 콘솔 작업으로 참고 표시 후 `todo` 로 갑니다.

### GEO 는 추측하지 않고 측정합니다

`--access-log <파일>` 을 주면(nginx·Apache·Cloudflare·Vercel, `.gz` 가능) GEO 에서 유일한 실측 근거를 얻습니다 — **AI 크롤러가 실제로 우리 사이트를 가져갔는지**:

```
AI crawler activity (last 30d, ./access.log)
  citation        OAI-SearchBot 41 · Claude-SearchBot 12   ← 인용될 자격
  user-triggered  ChatGPT-User 7                          ← AI 안에서 실제로 들어온 사람
  training        GPTBot 88 · ClaudeBot 31
  search          Googlebot 240 · bingbot 55
```

`citation none` 이면 콘텐츠가 아무리 좋아도 인용될 수 없습니다. robots.txt 에서 **허용된 것만으로는 아무것도 증명되지 않습니다.**

| 그룹 | 수 | 내용 |
| --- | --- | --- |
| CORE | 17 | robots.txt · 사이트맵 · canonical · title/description · 초기 HTML 본문 · `lang` 일치 · 오픈그래프 · IndexNow 키 |
| GOOGLE | 7 | 소유확인 · `noindex` · **`nosnippet`** · `Google-Extended` · JSON-LD · Indexing API 오용 |
| NAVER | 4 | **Yeti 차단**(모두에게 검사) · 소유확인 · RSS · 콘솔 등록 — 뒤 3개는 선택 안내이고 실패로 뜨지 않습니다 |
| YAHOO | 1 | Yahoo! JAPAN 자체 크롤러 `Y!J-*` (모두에게 검사 — 허용은 공짜) |
| BING | 3 | 소유확인 · bingbot · 등록(GSC import 우회 안내) |
| GEO | 12 | **인용 봇 허용** · 학습 봇 정책 · 사용자 트리거 봇 · **액세스 로그 기반 실제 크롤 여부** · 정책 위반 탐지 · 텍스트 형태 · 내부 링크 · 제목 구조 · 날짜 · 엔티티 마크업 · 인용 신호 |

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

## 검증된 것과 아닌 것

실사이트 3곳(Next.js 모노레포 · 마케팅 사이트 · Vite SPA)에서 확인했습니다.

- **네이버 IndexNow 가 실제로 동작합니다** — 그리고 테스트하기 전까지는 동작하지 않았습니다. 요청에 `keyLocation` 이 실려 있어 네이버가 모든 제출에 422 를 반환하고 있었고, 지금은 양쪽 모두 200 입니다.
- **Claude Code 밖에서도 동작합니다** — Codex 가 스킬을 찾아 번들 스크립트를 실행하고 리포트를 옮깁니다.
- **결정성 유지** — 같은 사이트를 두 번 검사하면 판정 집합이 동일합니다.
- **모든 인용 URL 이 응답**하고, 핵심 규칙은 인용 페이지를 다시 읽어 주장과 대조했습니다. 근거가 뒷받침하지 않던 규칙 4개를 정정·분리했습니다.

아직 열린 것: 저가 모델(DeepSeek·Kimi 등)이 `SKILL.md` 를 따르는지 · 한글 20%/가나 5% 임계값은 측정이 아니라 판단 · Antigravity 등은 경로만 맞춰뒀고 실행은 안 해봤습니다.

## 잔소리하지 않습니다

행동으로 옮길 수 없는 지적은 소음입니다:

- **적용될 수 없는 규칙은 아예 돌리지 않습니다.** 게시일·산문 구조는 실제로 글 성격인 페이지에서만 검사하고, AI 크롤러 측정은 로그를 줄 때만 합니다. 이건 `n/a` 로 이유와 함께 나오고 "확인 불가" 로 쌓이지 않습니다.
- **콘솔 등록은 명령이 아니라 조건형으로** 말합니다 — 이미 했는지 밖에서 알 방법이 없으니까요. `--done GOOGLE-07` 로 한 번 알려주면 다시 안 묻습니다.
- **이미지가 많다고 감점하지 않습니다.** 예전 규칙이 텍스트 길이를 이미지 개수로 나눠서, 랜딩 페이지를 랜딩 페이지라는 이유로 벌하고 있었습니다. 진짜 검사는 "본문 텍스트가 있느냐"(`CORE-12`)입니다.

## 언어

코드·규칙·리포트·`SKILL.md` 는 전부 **영어**입니다. 이 문서만 국문 번역입니다 ([English](./README.md)).

**그렇다고 영어로 답하지는 않습니다.** 에이전트는 사용자가 쓰는 언어로 답하고, `SKILL.md` 가 "리포트를 그대로 붙이지 말고 사용자 언어로 옮겨라" 라고 지시합니다. 영어가 그대로 보이는 건 **터미널에서 스크립트를 직접 실행할 때**뿐입니다.

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
