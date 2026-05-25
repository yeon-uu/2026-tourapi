# AI-DO System Architecture

> 전국 기차역 가챠 + AI 관광 체크리스트 + 스탬프 컬렉션 서비스
> 2026 관광데이터 활용 공모전 — 생성형 AI 활용 관광 프롬프톤 부문

---

## 1. FR/NFR 정의 및 규모 추정

### 1-1. Functional Requirements (FR)

| ID | 기능 | 설명 |
|----|------|------|
| FR-1 | 역 가챠 | KTX + 동해산타열차 ~62개역 중 가중치 기반 뽑기. 하루 5회 제한, 출발역/스탬프역 제외, 전체 수집 시 뽑기 불가 |
| FR-2 | AI 체크리스트 생성 | 뽑힌 역 주변 TourAPI 관광데이터 기반으로 AI가 3~5개 현장 미션 생성 |
| FR-3 | 체크리스트 완료 | 사용자가 미션을 셀프 체크하여 완료 처리. 미완료 상태에서도 새 뽑기 가능 |
| FR-4 | 스탬프 획득 | 체크리스트 완료 시 해당 역 스탬프 획득 |
| FR-5 | 스탬프 컬렉션 | 기찻길 아카이브 UI, 노선별 그룹핑, 미획득 역 잠금 표시 |
| FR-6 | 사용자 인증 | 닉네임 + 출발역 입력 → JWT 발급 (게스트 로그인) |
| FR-7 | 스탬프 공유 | 스탬프 획득 후 카드 형태로 사진 저장 가능 |

### 1-2. Non-Functional Requirements (NFR)

| ID | 항목 | 목표 | 근거 |
|----|------|------|------|
| NFR-1 | 응답 시간 | 가챠/체크리스트 외 API < 200ms | 심사 시연 시 쾌적한 UX |
| NFR-2 | AI 생성 시간 | 체크리스트 생성 < 10s | LLM 호출 특성상 스트리밍으로 체감 시간 단축 |
| NFR-3 | 가용성 | 99% (심사 기간 중 다운타임 없음) | 공모전 심사 = 1회성, 장애 시 치명적 |
| NFR-4 | 동시 사용자 | ~50명 | 공모전 심사위원 + 데모 사용자 |
| NFR-5 | 보안 | HTTPS, SQL Injection 방어, 리소스 소유권 검증, XSS 방어, Rate limiting | OWASP Top 10 대응 |
| NFR-6 | 배포 | EC2 단일 인스턴스 | 예산 제약 |

### 1-3. Back-of-Envelope 규모 추정

```
동시 사용자: ~50명 (심사 + 테스트)
일일 가챠 요청: ~250회 (50명 × 5회/일)
일일 AI 생성 요청: ~200회
AI API 비용: 200 req × ~$0.01/req = ~$2/day (GPT-4o-mini 기준)
DB 크기: 역 ~62개 + 관광지 캐시 ~300건 + 유저 ~100명 = < 10MB
트래픽: < 1 req/s (EC2 t3.small 충분)
```

---

## 2. 데이터 모델 & DB 선정

### 2-1. ADR: DB 선정

```
ADR-001: PostgreSQL 선정

Status: Accepted

Context:
- 스탬프 획득은 "체크리스트 완료 → 스탬프 생성"의 트랜잭션 무결성 필요
- 역/관광지 데이터는 정형 데이터 (위치, 이름, 카테고리)
- 팀이 Roame 프로젝트에서 PostgreSQL + SQLAlchemy 경험 보유
- 데이터 규모 < 50MB, 복잡한 쿼리 없음

Decision:
PostgreSQL 단일 인스턴스 사용

Consequences:
+ ACID 보장 → 스탬프 중복 획득 방지
+ 팀 학습 비용 0
+ JSON 컬럼으로 AI 생성 미션 유연하게 저장 가능
- 규모 대비 오버스펙이나 SQLite 대비 운영 안정성 확보
```

### 2-2. ERD

```
┌──────────────────────┐     ┌──────────────────────┐
│       users           │     │      stations         │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)              │
│ nickname             │     │ name                 │
│ departure_station_id │     │ line_name            │
│   (FK → stations)    │     │ train_type           │
│ created_at           │     │   (ktx / santa)      │
└────────┬─────────────┘     │ requires_transfer    │
         │                   │ lat / lng            │
         │                   │ region_type          │
         │                   │ weight               │
         │                   │ stamp_image_url      │
         │                   └──────────┬───────────┘
         │                         │
    ┌────▼─────────────────────────▼───┐
    │           gacha_draws             │
    ├───────────────────────────────────┤
    │ id (PK)                          │
    │ user_id (FK → users)             │
    │ station_id (FK → stations)       │
    │ rarity (normal/rare/ssr)         │
    │ created_at                       │
    └────────────────┬─────────────────┘
                     │
         ┌───────────▼────────────┐
         │      checklists        │
         ├────────────────────────┤
         │ id (PK)               │
         │ draw_id (FK, UNIQUE)  │
         │ missions (JSONB)      │
         │ status (pending/done) │
         │ completed_at          │
         └───────────┬───────────┘
                     │
         ┌───────────▼────────────┐
         │       stamps           │
         ├────────────────────────┤
         │ id (PK)               │
         │ user_id (FK → users)  │
         │ station_id (FK)       │
         │ checklist_id (FK)     │
         │ rarity                │
         │ acquired_at           │
         │ UNIQUE(user, station) │
         └────────────────────────┘
```

### 2-3. missions JSONB 구조

```json
[
  {
    "seq": 1,
    "title": "해운대 해변에서 일출 사진 찍기",
    "description": "해운대역에서 도보 10분, 해변 산책로에서 인증샷을 남겨보세요",
    "completed": false
  }
]
```

**ADR-002: missions를 JSONB로 저장**

```
Status: Accepted

Context:
- 미션 개수가 3~5개로 적고, AI가 매번 다른 구조 생성 가능
- 별도 테이블로 분리하면 조인 복잡도만 증가
- 미션별 개별 쿼리 불필요 (항상 체크리스트 단위로 조회)

Decision: JSONB 컬럼으로 체크리스트 내 저장

Consequences:
+ 스키마 유연성 — AI 출력 변경 시 마이그레이션 불필요
+ API 응답 구조와 1:1 매핑
- 개별 미션 검색 어려움 (필요 없음)
```

---

## 3. API 설계

### 3-1. ADR: 인증 방식

```
ADR-003: JWT 게스트 로그인

Status: Accepted

Context:
- 공모전 시연 시 빠른 로그인 필요 (회원가입 허들 제거)
- 12일 프로젝트에서 OAuth 연동은 시간 대비 가치 낮음
- 출발역 입력이 필요하므로 로그인 단계에서 함께 수집

Decision: 닉네임 + 출발역 입력 → JWT 발급 (게스트 로그인)

Consequences:
+ 구현 30분 이내, 즉시 사용 가능
+ 출발역을 로그인 시점에 자연스럽게 수집
+ Stateless → 서버 부담 없음
- 기기 변경 시 데이터 연속성 없음 → 공모전 시연에서 무관
```

### 3-2. 엔드포인트

```
Base URL: /api/v1

[인증]
POST   /auth/guest              닉네임 + 출발역 → JWT 발급

[가챠]
POST   /gacha/draw              역 뽑기 (5회/일, 출발역/스탬프역 제외)  ※ Rate limit: IP당 10회/분
GET    /gacha/history            내 뽑기 이력

[체크리스트]
GET    /checklists/{draw_id}    특정 뽑기의 체크리스트 조회
POST   /checklists/{draw_id}/generate   AI 체크리스트 생성 (SSE)    ※ Rate limit: IP당 5회/분
PATCH  /checklists/{id}/missions/{seq}  미션 완료 토글
POST   /checklists/{id}/complete        체크리스트 완료 → 스탬프 발급

[스탬프]
GET    /stamps                  내 스탬프 컬렉션
GET    /stamps/stats             통계 (노선별 수집률 등)

[역 정보]
GET    /stations                역 목록 (출발역 드롭다운용)

[운영]
GET    /health                  헬스 체크
```

### 3-3. 보안: 리소스 소유권 검증

모든 리소스 접근 엔드포인트에서 현재 유저의 소유권을 검증한다 (OWASP A01 대응).

```python
# FastAPI dependency — 모든 리소스 라우터에 공통 적용
async def verify_ownership(resource, current_user: User):
    if resource.user_id != current_user.id:
        raise HTTPException(403, "Forbidden")
```

적용 대상:
- `GET /checklists/{draw_id}` — draw의 user_id 검증
- `PATCH /checklists/{id}/missions/{seq}` — checklist → draw → user_id 검증
- `POST /checklists/{id}/complete` — 동일
- `GET /gacha/history`, `GET /stamps` — JWT의 user_id로 필터링 (쿼리 레벨)

### 3-4. 보안: LLM 출력 XSS 방어

AI가 생성한 미션 텍스트는 신뢰할 수 없는 입력으로 취급한다 (OWASP A03/A07 대응).

```
방어 레이어:
1. Backend: LLM 응답을 DB 저장 전에 HTML 태그 스트립 (bleach or html.escape)
2. Frontend: DOM 삽입 시 textContent 사용, innerHTML 금지
3. Nginx: Content-Security-Policy 헤더 추가 (script-src 'self')
```

### 3-5. AI 체크리스트 생성 플로우

```
Client                    Backend                  TourAPI          LLM (OpenAI)
  │                         │                        │                  │
  │  POST /generate         │                        │                  │
  │────────────────────────►│                        │                  │
  │                         │  GET /areaBasedList    │                  │
  │                         │───────────────────────►│                  │
  │                         │◄───────────────────────│                  │
  │                         │  관광지 데이터 수집      │                  │
  │                         │                        │                  │
  │                         │  프롬프트 + 관광 데이터  │                  │
  │                         │─────────────────────────────────────────►│
  │  SSE: mission 1         │◄─────────────────────────────────────────│
  │◄────────────────────────│  스트리밍 응답                            │
  │  SSE: mission 2         │                        │                  │
  │◄────────────────────────│                        │                  │
  │  SSE: complete          │                        │                  │
  │◄────────────────────────│  DB 저장               │                  │
```

---

## 4. 고수준 아키텍처 다이어그램

```
                         ┌─────────────────────────────────────────┐
                         │              EC2 (t3.small)             │
                         │                                         │
┌──────────┐    HTTPS    │  ┌─────────┐    ┌───────────────────┐   │
│          │────────────►│  │  Nginx  │───►│  FastAPI (Uvicorn)│   │
│  Client  │◄────────────│  │  :443   │    │  :8000            │   │
│ (Browser)│    SSE      │  └─────────┘    │                   │   │
│          │             │                  │  ┌─────────────┐ │   │
└──────────┘             │                  │  │ TourAPI     │ │   │
                         │                  │  │ Client      │─┼───┼──► TourAPI
                         │                  │  └─────────────┘ │   │
                         │                  │                   │   │
                         │                  │  ┌─────────────┐ │   │
                         │                  │  │ LLM Client  │─┼───┼──► OpenAI API
                         │                  │  │ (AsyncIO)   │ │   │
                         │                  │  └─────────────┘ │   │
                         │                  │                   │   │
                         │                  └───────┬───────────┘   │
                         │                          │               │
                         │                  ┌───────▼───────────┐   │
                         │                  │   PostgreSQL      │   │
                         │                  │   :5432           │   │
                         │                  └───────────────────┘   │
                         │                                         │
                         │  ┌─────────────────────────────────┐    │
                         │  │  Static Files (HTML/CSS/JS)     │    │
                         │  │  served by Nginx                │    │
                         │  └─────────────────────────────────┘    │
                         └─────────────────────────────────────────┘

                         ┌─────────────────────────────────────────┐
                         │           GitHub Actions CI/CD          │
                         │  lint → test → build → deploy (SSH)     │
                         └─────────────────────────────────────────┘
```

### 4-1. ADR: 모놀리식 아키텍처

```
ADR-004: 모놀리식 단일 서버

Status: Accepted

Context:
- 3명 팀, 12일 개발
- 마이크로서비스는 인프라 오버헤드가 개발 시간 잠식
- 동시 사용자 ~50명, 트래픽 < 1 req/s

Decision: FastAPI 단일 앱 + Nginx + PostgreSQL, 모두 EC2 1대

Consequences:
+ 배포/디버깅/로깅 단순
+ 팀원 간 코드 충돌 최소화 (모듈 분리로 해결)
+ 비용 최소 (EC2 1대)
- 단일 장애점 (SPOF) — 공모전 규모에서 허용 가능
- 스케일아웃 불가 — 불필요
```

### 4-2. ADR: 프론트엔드 전략

```
ADR-005: Vanilla HTML/CSS/JS (SPA 프레임워크 미사용)

Status: Accepted

Context:
- 프론트 담당 1명, 12일
- LLM 보조 코딩 (와이어프레임 → HTML/CSS 자동 생성)
- 페이지 5개 미만 (가챠, 체크리스트, 컬렉션, 로그인, 메인)
- 프롬프톤 심사는 AI 활용도가 핵심, 프론트 프레임워크 가산점 없음

Decision: Vanilla HTML/CSS/JS, Nginx에서 정적 파일 서빙

Consequences:
+ LLM이 가장 잘 생성하는 스택 (즉시 결과물)
+ 빌드 파이프라인 불필요
+ 번들 사이즈 최소 → 로딩 빠름
- 상태 관리 복잡해질 수 있음 → 5페이지 미만이라 문제 없음
- 컴포넌트 재사용 어려움 → 규모상 불필요
```

---

## 5. DevSecOps 파이프라인

### 5-1. CI/CD 파이프라인

```yaml
# .github/workflows/ci-cd.yml 구조 (2-Phase)

trigger: push to main, PR to main

jobs:
  # Phase 1 — Day 1부터 적용 (핵심만)
  lint-and-test:
    steps:
      - ruff check .                    # Python 린터
      - black --check .                 # 포맷 검사
      - pytest --cov=app tests/         # 유닛 테스트 + 커버리지

  build:
    needs: [lint-and-test]
    steps:
      - docker build -t ai-do:$SHA .
      - docker compose config --quiet   # compose 파일 검증

  deploy:
    needs: [build]
    if: github.ref == 'refs/heads/main'
    steps:
      - SSH into EC2
      - docker compose pull && docker compose up -d
      - health check: curl https://ai-do.example.com/health

  # Phase 2 — Day 9 이후, 시간 여유 시 추가
  security-scan:
    steps:
      - pip-audit                       # 의존성 취약점 스캔
    # bandit, trufflehog: 제출 전 1회 수동 실행으로 대체
```

### 5-2. ADR: CI/CD 수준

```
ADR-006: 경량 CI/CD (GitHub Actions + SSH 배포)

Status: Accepted (Revised — CI 2-Phase 전략)

Context:
- Kubernetes, ECS 등은 12일 프로젝트에 과도
- 팀이 GitHub Actions 경험 있음 (Roame CI)
- 배포 빈도: 하루 2~3회
- 보안 스캔 6종을 초기부터 적용하면 CI 디버깅에 하루 소요 위험

Decision:
- Phase 1 (Day 1~): ruff + black + pytest (핵심만)
- Phase 2 (Day 9~): pip-audit 추가 (시간 여유 시)
- bandit + trufflehog: 제출 전 수동 1회 실행
- CD: SSH로 EC2 접속 → docker compose up

Consequences:
+ 초기 셋업 15분 이내
+ CI 실패로 인한 개발 블로킹 최소화
+ 제출 전 수동 보안 스캔으로 최소한의 DevSecOps 충족
- 블루/그린 배포 없음 → 배포 시 ~10초 다운타임 (허용)
- 롤백은 수동 (docker compose down → 이전 이미지 up)
```

---

## 6. 확장성 전략

### 6-1. 현실적 범위 (공모전용)

| 전략 | 적용 여부 | 구현 |
|------|-----------|------|
| **캐싱** | O | TourAPI 응답을 Redis or 인메모리 캐시 (TTL 24h) |
| **비동기 처리** | O | AI 생성은 AsyncIO + SSE 스트리밍 |
| **로드밸런싱** | X | 단일 인스턴스, 불필요 |
| **DB 인덱싱** | O | stations(train_type), stamps(user_id, station_id) |
| **CDN** | X | 정적 파일 Nginx 서빙으로 충분 |

### 6-2. ADR: TourAPI 캐싱

```
ADR-007: TourAPI 응답 인메모리 캐시

Status: Accepted

Context:
- TourAPI 호출 제한 존재 (일일 쿼터)
- 같은 역의 관광지 데이터는 자주 변경되지 않음
- Redis 추가 시 인프라 복잡도 증가

Decision:
- Python dict 기반 인메모리 캐시 (cachetools TTLCache)
- TTL: 24시간
- 키: station_id + content_type

Consequences:
+ 추가 인프라 없음
+ TourAPI 쿼터 절약
+ 동일 역 재뽑기 시 AI 생성 속도 향상
- 서버 재시작 시 캐시 소멸 → 공모전 규모에서 무관
- 메모리 사용량 증가 → ~300건 × ~2KB = ~600KB, 무시 가능
```

### 6-3. 비동기 처리 상세

```python
# AI 체크리스트 생성 — SSE 스트리밍 패턴

async def generate_checklist(draw_id):
    # 1. TourAPI 호출 (async httpx)
    spots = await tour_api.get_nearby_spots(station.lat, station.lng)

    # 2. LLM 스트리밍 호출
    async for chunk in llm.stream_generate(station, spots):
        yield f"data: {chunk}\n\n"  # SSE

    # 3. 완료 후 DB 저장
    await save_checklist(draw_id, missions)
```

---

## 7. 트레이드오프 분석

### 7-1. 설계의 약점과 대안

| # | 약점 | 영향도 | 대안 | 안 쓰는 이유 |
|---|------|--------|------|-------------|
| 1 | **SPOF** (EC2 1대) | 서버 다운 = 서비스 중단 | Multi-AZ, ALB | 12일 + 예산 제약, 심사 시간대만 안정이면 됨 |
| 2 | **인메모리 캐시** 휘발성 | 재시작 시 TourAPI 재호출 | Redis | 10MB 캐시에 별도 서비스 추가는 오버엔지니어링 |
| 3 | **Vanilla JS** 상태 관리 | 복잡한 UI 상호작용 어려움 | React/Vue | 5페이지 미만, LLM 생성 효율이 더 중요 |
| 4 | **JWT만 사용** (refresh 없음) | 토큰 만료 시 재로그인 | Refresh token | 공모전 시연 = 단기 세션, 만료 길게 설정 |
| 5 | ~~AI 비용 통제 없음~~ | ~~악의적 대량 호출 시 비용 폭증~~ | ~~Rate limiting~~ | **해결됨** — slowapi Rate limiting 적용 (3-2 참조) |
| 6 | **SSH 배포** | 수동 롤백 | ArgoCD, ECS | 배포 빈도 낮고 팀 규모 작아 수동으로 충분 |

### 7-2. 핵심 리스크와 대응

```
Risk-1: LLM API 장애 시 체크리스트 생성 불가
  → 대응: 사전 생성 캐시 (인기 역 10~20개는 미리 생성해두기)
  → 대응: fallback 프롬프트 (간단한 템플릿 기반 미션)

Risk-2: TourAPI 쿼터 초과
  → 대응: 인메모리 캐시 (ADR-007)
  → 대응: 개발 중 mock 데이터 사용, 실제 API는 시연 직전에 갱신

Risk-3: 심사 당일 서버 불안정
  → 대응: 심사 전날 전체 시나리오 리허설
  → 대응: 주요 시연 흐름의 응답을 캐싱/사전 생성

Risk-4: EC2 장애로 DB 데이터 유실
  → 대응: pg_dump 크론잡 (1시간 간격) + S3 업로드
  → 대응: 심사 전날 AMI 스냅샷 생성 → 10분 내 복구 가능
```

---

## 부록: Docker Compose 구조

```yaml
# docker-compose.yml

services:
  app:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://ai_do:pw@db:5432/ai_do
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - TOUR_API_KEY=${TOUR_API_KEY}
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=ai_do
      - POSTGRES_USER=ai_do
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ai_do"]
      interval: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app

  db-backup:
    image: postgres:16-alpine
    volumes:
      - ./backups:/backups
    environment:
      - PGPASSWORD=${DB_PASSWORD}
    entrypoint: >
      sh -c "while true; do
        pg_dump -h db -U ai_do ai_do > /backups/ai_do_$$(date +%Y%m%d_%H%M).sql;
        find /backups -name '*.sql' -mtime +3 -delete;
        sleep 3600;
      done"
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

---

## 부록: 디렉토리 구조

```
ai-do/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # 환경변수
│   │   ├── database.py          # DB 연결, Base
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── station.py
│   │   │   ├── gacha.py
│   │   │   ├── checklist.py
│   │   │   └── stamp.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── gacha.py
│   │   │   ├── checklist.py
│   │   │   └── stamp.py
│   │   ├── services/
│   │   │   ├── gacha_service.py     # 가중치 뽑기 로직
│   │   │   ├── tour_api.py          # TourAPI 클라이언트
│   │   │   ├── llm_service.py       # LLM 호출 + 프롬프트
│   │   │   └── checklist_service.py
│   │   ├── dependencies/
│   │   │   ├── auth.py              # JWT 검증, get_current_user
│   │   │   └── ownership.py         # 리소스 소유권 검증
│   │   └── utils/
│   │       ├── cache.py             # TTLCache 래퍼
│   │       ├── sanitize.py          # LLM 출력 HTML sanitize
│   │       └── rate_limit.py        # slowapi Rate limiter 설정
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── login.html              # 닉네임 + 출발역 → JWT (토큰 있으면 자동 건너뜀)
│   ├── index.html              # 뽑기 + 미션 + 스탬프 받기 (내부 단계 전환)
│   ├── share.html              # 스탬프 카드 + 사진 저장
│   ├── collection.html         # 기찻길 아카이브
│   ├── css/
│   ├── js/
│   │   ├── api.js              # fetch wrapper, base URL, 에러 처리
│   │   ├── auth.js             # JWT localStorage 관리, 헤더 자동 주입
│   │   ├── main.js             # index.html 로직 (뽑기 + 미션 + 완료)
│   │   ├── collection.js       # 아카이브 페이지 로직
│   │   └── common.js           # DOM 헬퍼, 날짜 포맷
│   └── assets/
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci-cd.yml
└── docs/
    └── ARCHITECTURE.md
```

---

## 부록: AI친구 의존성 (대기 항목)

| 항목 | 담당 | 설명 | 영향 범위 |
|------|------|------|-----------|
| **역 시드 데이터** | AI친구 (TourAPI) | TourAPI에서 KTX + 동해산타열차 역 목록을 추출한 후, 본인이 stations 테이블 시드 생성 | stations 테이블, 가챠 로직 전체 |
| **인구소멸지역 가중치** | AI친구 | 인구소멸지역 리스트업 후 각 역의 weight, region_type 값 확정 | stations.weight, stations.region_type, 가챠 확률 |

- 위 데이터가 도착하기 전까지 가챠 서비스는 **mock 역 데이터**로 개발/테스트
- 데이터 도착 후 `backend/app/seeds/stations.json` 생성 → DB insert 스크립트 실행

---

## 부록: 개발 일정 (12일)

| Phase | 기간 | 담당 | 산출물 |
|-------|------|------|--------|
| **Day 1-2** | 5.24-25 | 전체 | 환경 셋업, DB 스키마, 와이어프레임 확정 |
| **Day 3-5** | 5.26-28 | 본인: API + DB | 가챠/체크리스트/스탬프 API 완성 |
| | | AI: TourAPI + LLM | TourAPI 연동 + 프롬프트 설계 |
| | | 기획: 프론트 | 와이어프레임 → HTML/CSS (LLM 보조) |
| **Day 6-8** | 5.29-31 | 본인: 프론트 연동 | API ↔ 프론트 연결, 가챠 애니메이션 |
| | | AI: 프롬프트 튜닝 | 미션 품질 개선 + 데이터 정제 |
| | | 기획: UI 마무리 | 스탬프 UI, 반응형 |
| **Day 9-10** | 6.1-2 | 전체 | 통합 테스트, 버그 수정, 배포 |
| **Day 11-12** | 6.3-4 | 전체 | 시연 리허설, 엣지케이스 대응, 최종 점검, 제출 자료 준비 |
