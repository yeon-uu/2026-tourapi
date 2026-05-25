# CLAUDE.md — AI-DO 프로젝트 개발 가이드

> 전국 기차역 가챠 + AI 관광 체크리스트 + 스탬프 컬렉션 서비스
> 2026 관광데이터 활용 공모전 — 생성형 AI 활용 관광 프롬프톤 부문

---

## 프로젝트 개요

- **스택**: FastAPI + PostgreSQL 16 + Nginx + Vanilla HTML/CSS/JS
- **배포**: EC2 (t3.small) 단일 인스턴스, Docker Compose
- **팀**: 3명, 12일 (5/24 ~ 6/4)
- **아키텍처 문서**: `docs/ARCHITECTURE.md` (ERD, API, ADR 등 모든 설계 결정의 진실 소스)

---

## 핵심 규칙 — 바이브코딩 가드레일

### 1. 파일 간 일관성을 최우선으로 유지하라

AI가 파일 단위로 코드를 생성하면 파일 간 불일치가 발생한다. 아래 항목은 반드시 확인:

- SQLAlchemy 모델 필드명 == Pydantic 스키마 필드명 == 프론트 JS의 필드명
- `config.py`의 환경변수명 == `docker-compose.yml`의 환경변수명 == `.env.example`의 키
- 라우터의 URL 경로 == 프론트 JS의 fetch URL
- 서비스 함수의 리턴 타입 == 라우터가 기대하는 타입

### 2. 한 번에 1개씩 만들어라

"가챠 전체를 만들어줘"가 아니라 순서대로:
1. 모델 → 2. 스키마 → 3. 서비스 → 4. 라우터 → 5. 프론트 연동

한 단계가 동작 확인되면 다음으로 넘어간다. 과잉 생성(사용하지 않는 관리자 페이지, 통계 API 등)을 하지 않는다.

### 3. async/await를 일관되게 사용하라

이 프로젝트는 완전 비동기 스택이다:
- 모든 DB 접근 함수는 `async def` + `await`
- httpx 호출도 `async`
- 한 함수 내에서 동일한 DB 세션을 사용 (세션 분리 금지)
- sync 함수 안에서 await를 쓰는 실수를 하지 않는다

### 4. 보안은 생성 시점에 적용하라 (사후 추가 금지)

| 항목 | 규칙 |
|------|------|
| 리소스 소유권 | 모든 리소스 접근 시 `resource.user_id == current_user.id` 검증 (OWASP A01) |
| LLM 출력 XSS | DB 저장 전 `html.escape()` 처리, 프론트에서 `textContent`만 사용, `innerHTML` 금지 (OWASP A03/A07) |
| Rate limiting | `/gacha/draw` (10회/분), `/checklists/generate` (5회/분) — slowapi 사용 |
| 시크릿 | 코드에 하드코딩 금지. `config.py`에서 환경변수로만 로드. JWT secret은 최소 256-bit |
| CORS | FastAPI `CORSMiddleware`에서만 설정. Nginx에서 중복 설정하지 않는다 |
| 에러 메시지 | 500 에러 시 내부 스택 트레이스를 클라이언트에 노출하지 않는다 |

### 5. SSE 스트리밍 구현 시 필수 사항

- Nginx `proxy_buffering off` 설정 필수 (안 하면 스트리밍이 한 번에 몰아서 도착)
- 프론트 `EventSource` 사용 시 에러 핸들링 + 타임아웃 처리 필수
- LLM 스트리밍 중간에 끊길 경우의 에러 이벤트 전송 처리
- SSE 응답 헤더: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

### 6. Docker 환경 주의사항

- DB 연결은 `localhost:5432`가 아니라 `db:5432` (Docker 네트워크)
- `depends_on`만으로 불충분 → `condition: service_healthy` + healthcheck 필수
- compose 환경변수와 코드 기본값이 충돌하지 않도록 `.env.example` 기준으로 통일

### 7. 트랜잭션 무결성

체크리스트 완료 → 스탬프 발급은 반드시 한 트랜잭션:
```python
async with db.begin():
    checklist.status = "done"
    checklist.completed_at = datetime.utcnow()
    stamp = Stamp(user_id=..., station_id=..., ...)
    db.add(stamp)
# UNIQUE(user, station) 위반 시 IntegrityError → 409 Conflict 응답
```

### 8. 프론트엔드 (Vanilla JS) 구조 규칙

전역변수 남발과 중복 코드를 방지하기 위해 파일 역할을 분리:

```
js/
├── api.js          # 모든 API 호출 함수 집중 (fetch wrapper, base URL, 에러 처리)
├── auth.js         # JWT 토큰 저장/조회/삭제, Authorization 헤더 주입
├── gacha.js        # 가챠 페이지 로직
├── checklist.js    # 체크리스트 페이지 로직 + SSE 수신
├── collection.js   # 스탬프 컬렉션 페이지 로직
└── common.js       # 공통 유틸 (DOM 헬퍼, 날짜 포맷 등)
```

- `api.js`의 fetch wrapper가 `auth.js`에서 토큰을 가져와 헤더에 자동 주입
- 페이지별 JS는 `api.js`의 함수만 호출, 직접 fetch 금지
- DOM 삽입 시 `textContent` 사용 (XSS 방어)

---

## 환경변수 계약 (.env.example 기준)

```
# DB
DATABASE_URL=postgresql+asyncpg://ai_do:password@db:5432/ai_do
DB_PASSWORD=password

# Auth
JWT_SECRET_KEY=          # 최소 256-bit 랜덤 문자열
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440  # 24시간 (공모전 시연용)

# External APIs
OPENAI_API_KEY=
TOUR_API_KEY=
```

모든 파일은 이 변수명을 그대로 사용한다. 오타/변형 금지.

---

## 설계 원칙 (systemdesignplaybook 참조)

1. **Design for Failure** — 외부 API(TourAPI, OpenAI)는 실패한다고 가정. fallback 필수
2. **Security by Design** — 보안은 사후 추가가 아니라 생성 시점에 적용
3. **YAGNI + KISS** — 필요하지 않은 것을 만들지 않는다. 12일 프로젝트에서 과잉 설계는 적
4. **Document Architecture** — 설계 변경 시 `docs/ARCHITECTURE.md`의 ADR 업데이트
5. **Automate Everything** — CI는 Phase 1(ruff+black+pytest)부터 적용

---

## 시큐어코딩 원칙 (OWASP 기반)

1. **입력 검증** — 모든 사용자 입력과 LLM 출력을 검증/새니타이즈
2. **매개변수화 쿼리** — SQLAlchemy ORM 사용 시에도 raw SQL은 매개변수화
3. **시크릿 관리** — 환경변수로만 로드, 코드/로그에 노출 금지
4. **HTTPS 강제** — Nginx에서 HTTP → HTTPS 리다이렉트
5. **CORS 화이트리스트** — 와일드카드(*) 사용 금지, 도메인 명시
6. **에러 처리** — 민감 정보를 에러 응답에 포함하지 않음

---

## 알려진 함정 (트러블슈팅 사전 기록)

| 함정 | 원인 | 해결 |
|------|------|------|
| passlib + bcrypt 호환성 | passlib이 bcrypt 4.1+의 내부 API 변경에 대응 못함 | bcrypt==4.0.x 고정 또는 passlib 대신 직접 bcrypt 사용 |
| pip-audit + python-jose 충돌 | python-jose가 취약한 pyasn1 버전을 요구 | PyJWT로 대체 검토. pip-audit은 detect-only로 시작 |
| Docker 내 localhost != 호스트 | compose 서비스 간 통신은 서비스명 사용 | `db:5432`로 접속, `localhost` 사용 금지 |
| Nginx SSE 버퍼링 | Nginx 기본 설정이 upstream 응답을 버퍼링 | `proxy_buffering off; proxy_cache off;` 설정 |
| `.gitignore` 누락 | AI가 `.env`, `__pycache__` 등을 gitignore에 안 넣음 | 프로젝트 초기에 `.gitignore` 먼저 생성 |
| requirements.txt 버전 미고정 | 빌드마다 다른 버전 설치 → 재현 불가 | `pip freeze > requirements.txt`로 버전 핀 |

---

## 구현 순서 가이드

```
Phase 1: 기반 (Day 1-2)
  .gitignore → .env.example → config.py → database.py → models/ → Dockerfile → docker-compose.yml

Phase 2: 핵심 API (Day 3-5)
  dependencies/auth.py → routers/auth.py (게스트 로그인 먼저)
  → gacha_service.py → routers/gacha.py
  → tour_api.py → llm_service.py → checklist_service.py → routers/checklist.py
  → routers/stamp.py

Phase 3: 프론트 연동 (Day 6-8)
  js/api.js → js/auth.js → 각 페이지 HTML + JS
  nginx.conf (SSE proxy_buffering off 포함)

Phase 4: 통합 + 마무리 (Day 9-12)
  E2E 수동 테스트 (가챠→체크리스트→완료→스탬프 풀플로우)
  CI/CD (Phase 1: ruff+black+pytest)
  DB 백업 설정, 배포
```

---

## 커밋 컨벤션

```
feat: 새 기능 추가
fix: 버그 수정
refactor: 리팩터링 (기능 변경 없음)
docs: 문서 수정
chore: 설정, 빌드, 의존성 등
test: 테스트 추가/수정
```
