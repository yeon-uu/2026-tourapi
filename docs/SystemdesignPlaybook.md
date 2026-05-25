# System Design & Secure Infrastructure Playbook

> **작성자**: 연우 | **버전**: v1.0 | **최종 수정**: 2026.05  
> **트랙**: Platform Engineer / Security Engineer  
> **이 문서는 프로젝트마다 트러블슈팅을 추가하고, 분기별로 트렌드를 리뷰하며 살아있는 문서로 유지한다.**

---

## 목차

1. [동향 및 이슈 — 2025~2026 시스템 디자인 & 인프라 트렌드](#1-동향-및-이슈)
2. [아키텍처 설계 방법론 — 단계별 프레임워크](#2-아키텍처-설계-방법론)
3. [DB 선정 가이드 — 어떻게 데이터베이스를 고르는가](#3-db-선정-가이드)
4. [DevSecOps & 시큐어코딩 — CI/CD 파이프라인 보안](#4-devsecops--시큐어코딩)
5. [트러블슈팅 아카이브 — Mo:lib & Roame 실전 경험](#5-트러블슈팅-아카이브)
6. [역량 성장 로드맵 — 무엇을 보고 어디로 갈 것인가](#6-역량-성장-로드맵)
7. [체크리스트 — 프로젝트 시작 전 점검표](#7-체크리스트)
8. [시스템 설계 프롬프트 — 최적의 아키텍처를 도출하는 프롬프트](#8-시스템-설계-프롬프트)
9. [출처 및 참고자료](#9-출처-및-참고자료)

---

## 1. 동향 및 이슈

### 1.1 아키텍처 패러다임의 변화

2025년 시스템 디자인의 가장 큰 변화는 **의도적 모듈화(Deliberate Modularity)**로의 전환이다. Thoughtworks Technology Radar Vol.32(2025.04)와 InfoQ 2025 아키텍처 트렌드가 공통적으로 지적하는 핵심은, 무조건적 마이크로서비스가 아니라 **팀 구조와 흐름에 맞춘 사회기술적(Socio-technical) 아키텍처**를 설계하라는 것이다. [출처 1]

| 트렌드 | 설명 | 실무 적용 |
|--------|------|-----------|
| **Modular Monolith 재부상** | 마이크로서비스의 운영 부담을 줄이면서 모듈 경계를 명확히 유지. 독립적 스케일링이 불필요하면 모놀리스 선호 [출처 1] | Mo:lib 같은 중소규모 프로젝트에 적합 |
| **Event-Driven Architecture** | 서비스 간 느슨한 결합, 실시간 데이터 처리. Pub/Sub 패턴으로 컴포넌트 독립 스케일링 [출처 3] | 추천 시스템의 비동기 데이터 파이프라인 |
| **AI-Native Architecture** | 시스템 설계에 AI 컴포넌트(RAG, 벡터DB, LLM Gateway) 통합이 기본이 되는 추세 [출처 4] | pgvector로 임베딩 저장, LLM 추천 파이프라인 |
| **IaC + GitOps** | 인프라를 코드로 정의하고 Git을 단일 진실 소스로 사용. 보안 정책을 IaC 템플릿에 통합 [출처 5] | Terraform/Docker Compose + GitHub Actions |
| **Security-as-Code** | 보안 정책을 코드에 내장. Zero Trust를 코드로 강제 [출처 8] | gitleaks, pip-audit, Trivy 자동화 |
| **Composable Architecture** | 독립적으로 교체 가능한 컴포넌트 설계. API-first, 플러그인 구조 [출처 4] | API Gateway + 독립 서비스 모듈 |
| **Edge Computing** | 사용자 가까이에서 연산. CDN + Edge Function으로 지연시간 최소화 [출처 4] | Cloudflare Workers, Vercel Edge |

### 1.2 데이터베이스 동향

DB-Engines 2025 Q1 분석에서 PostgreSQL이 지속적 상승세를 보이며 OLTP의 실질적 기본 선택지가 되고 있다. [출처 1] Stack Overflow 2025 개발자 설문에서 PostgreSQL 사용률 **55.6%**, MySQL **40.5%**로 격차가 확대됐다. [출처 12] pgvector 확장으로 벡터 검색까지 지원하면서 별도 전문 DB 없이 AI 워크로드를 처리할 수 있게 됐다.

### 1.3 CI/CD 보안 위기

- Verizon 2025 DBIR: 공개 저장소에 노출된 시크릿의 **32%가 CI/CD 토큰**, 수정까지 중앙값 **94일** [출처 9]
- Datadog DevSecOps 2026 리포트: **87%**의 조직이 최소 1개의 알려진 취약점을 프로덕션에서 운영 중 [출처 9]
- GitHub Actions 워크플로우의 **71%**가 액션 버전을 고정하지 않은(unpinned) 상태 [출처 9]
- Wiz State of Code Security 2025: 기업의 **35%**가 보안 설정이 약한 self-hosted runner 사용 [출처 13]

### 1.4 주목할 보안 이슈

- AI 기반 취약점 탐지의 양극화: Claude가 FreeBSD/Linux 커널 CVE를 발견한 사례 vs curl의 AI slop으로 인한 바운티 프로그램 폐지
- Supply Chain 공격 증가: 의존성 체인을 통한 공격이 주요 위협으로 부상 [출처 6]
- OIDC Workload Identity: 저장형 시크릿 대신 단명(short-lived) 토큰 사용이 표준화 [출처 9]
- Container Image Signing: Cosign + SLSA provenance로 빌드-배포 체인 검증 [출처 9]

---

## 2. 아키텍처 설계 방법론

시스템 디자인 인터뷰와 실무에서 공통적으로 사용되는 RESHADED 프레임워크(Requirements, Estimation, Storage, High-level Design, APIs, Detailed Design, Evaluation, Deployment)를 실무에 맞게 재구성했다. [출처 15, 16]

### 2.1 설계 8단계 프레임워크

| 단계 | 핵심 질문 | 산출물 |
|------|-----------|--------|
| **1. 요구사항 정의** | FR(기능)과 NFR(비기능)은? 사용자 수, 읽기/쓰기 비율은? | FR/NFR 문서, SLA 정의 |
| **2. 규모 추정** | DAU, QPS(초당 쿼리), 저장 용량, 대역폭은 얼마나 필요한가? | Back-of-envelope 계산서 |
| **3. 데이터 모델 & DB 선정** | 어떤 엔티티가 있고 관계는? SQL vs NoSQL? ACID가 필요한가? | ERD, DB 선정 근거 ADR |
| **4. API 설계** | RESTful? GraphQL? gRPC? 인증 방식은? Rate Limiting은? | API 명세서(OpenAPI/Swagger) |
| **5. 고수준 설계(HLD)** | 주요 컴포넌트(LB, App Server, DB, Cache, Queue)와 데이터 흐름은? | 아키텍처 다이어그램 |
| **6. 상세 설계(LLD)** | 핵심 컴포넌트의 내부 로직, 알고리즘, 데이터 구조는? | 시퀀스/클래스 다이어그램 |
| **7. 확장성 & 병목 해결** | 파티셔닝/샤딩, 캐싱, 로드밸런싱, 비동기 처리 전략은? | 스케일링 전략 문서 |
| **8. 트레이드오프 분석** | CAP에서 어떤 것을 선택했고, 내 설계의 약점은 무엇인가? | ADR(Architecture Decision Record) |

### 2.2 Architecture Decision Record (ADR) 작성법

ADR은 아키텍처 의사결정의 이력을 남기는 문서다. 프로젝트 진행 중 변경 사항을 추적하고, 새 팀원의 빠른 온보딩을 지원한다. [출처 14]

```
Title: [결정 제목]
Status: Proposed / Accepted / Deprecated / Superseded
Context: 왜 이 결정이 필요한가?
Decision: 무엇을 결정했는가?
Consequences: 이 결정의 결과와 트레이드오프는?
Alternatives Considered: 검토했지만 선택하지 않은 대안들
```

### 2.3 설계 원칙 (Design Principles)

1. **Design for Failure** — 컴포넌트는 실패한다고 가정하고 회복력(Resilience)을 설계한다 [출처 2]
2. **Security by Design** — 모든 레이어에 보안을 통합한다 [출처 2]
3. **Automate Everything** — 배포부터 스케일링, 복구까지 자동화한다 [출처 2]
4. **Enable Observability** — 모니터링, 로깅, 트레이싱을 종합적으로 구현한다 [출처 2]
5. **Optimize for Cost** — 지속적으로 비용을 모니터링하고 최적화한다
6. **Document Architecture** — 아키텍처 다이어그램과 ADR을 최신 상태로 유지한다 [출처 14]
7. **YAGNI + KISS** — 필요하지 않은 것을 만들지 말고, 단순하게 유지한다

---

## 3. DB 선정 가이드

### 3.1 데이터베이스 선정 의사결정 트리

1. 트랜잭션(ACID)이 필수인가? → **Yes** → RDBMS (PostgreSQL / MySQL)
2. 스키마가 자주 변경되는가? → **Yes** → Document DB (MongoDB)
3. 초고속 Key-Value 접근이 필요한가? → **Yes** → Redis / DynamoDB
4. 관계가 복잡한 그래프 데이터인가? → **Yes** → Neo4j
5. 시계열 데이터인가? → **Yes** → TimescaleDB / InfluxDB
6. 벡터 유사도 검색이 필요한가? → **Yes** → pgvector / Pinecone / Milvus
7. 대규모 분석/웨어하우스? → **Yes** → Snowflake / BigQuery

### 3.2 PostgreSQL vs MySQL 비교

| 기준 | PostgreSQL | MySQL |
|------|-----------|-------|
| **ACID 준수** | 기본 설계부터 완전 ACID [출처 10] | InnoDB 엔진에서 지원 |
| **확장성** | 커스텀 타입, 연산자, 절차적 언어 지원 [출처 11] | 제한적 |
| **JSON 처리** | JSONB 네이티브 지원, 인덱싱 가능 [출처 11] | JSON 지원하나 성능 제한 |
| **벡터 검색** | pgvector 확장으로 AI 워크로드 지원 [출처 12] | 별도 솔루션 필요 |
| **Window Function** | 최적화된 네이티브 지원 | 8.0+에서 지원, 성능 제한적 |
| **읽기 성능** | 복잡한 쿼리에 강함 | 단순 읽기에 최적화 |
| **복제(Replication)** | 논리/물리 복제 모두 지원 | Group Replication 지원 |
| **커뮤니티 추세** | 2025 사용률 55.6% (SO 기준) [출처 12] | 2025 사용률 40.5% |

**결론**: 새 프로젝트에서는 PostgreSQL이 사실상 기본 선택지. 복잡한 쿼리, 엄격한 ACID, 확장성이 필요할 때 특히 강력하다. MySQL은 단순 읽기 중심 웹앱(WordPress, CMS)에서 여전히 유효하다. 다만 DB 선택보다 **어떻게 운영하느냐**가 더 중요하다. [출처 13]

---

## 4. DevSecOps & 시큐어코딩

### 4.1 Shift-Left 보안 전략

보안을 개발 초기 단계부터 통합하는 Shift-Left 접근이 핵심이다. 2025 State of Software Security 리포트에 따르면 거의 절반의 조직이 심각한 보안 부채를 안고 있다. [출처 7] SDLC의 모든 단계에 보안 체크를 내장하고, 개발자가 보안을 '소유'하는 문화를 만든다.

### 4.2 CI/CD 보안 파이프라인 구성

| 파이프라인 단계 | 보안 도구 | 검사 대상 |
|----------------|-----------|-----------|
| **코드 커밋** | gitleaks, git-secrets | 시크릿/API 키 노출 탐지 [출처 9] |
| **정적 분석(SAST)** | Semgrep, Bandit(Python), SonarQube | 소스 코드 취약점 [출처 6] |
| **의존성 검사(SCA)** | pip-audit, npm audit, Dependabot | 오픈소스 라이브러리 CVE [출처 7] |
| **컨테이너 스캔** | Trivy, Grype, Docker Scout | 컨테이너 이미지 취약점 [출처 13] |
| **동적 분석(DAST)** | OWASP ZAP, Nuclei | 런타임 취약점 [출처 6] |
| **IaC 스캔** | Checkov, tfsec | 인프라 설정 오류 [출처 5] |
| **이미지 서명** | Cosign + SLSA | 빌드-배포 체인 무결성 [출처 9] |
| **모니터링** | SIEM, Falco, Prometheus | 런타임 위협 탐지 |

### 4.3 GitHub Actions 보안 하드닝

- 액션 버전을 **SHA 해시로 고정** (unpinned action 71% 문제 해결) [출처 9]
- GITHUB_TOKEN 권한을 **최소화** (permissions: read-all)
- **OIDC Workload Identity**로 클라우드 인증 (저장형 시크릿 제거) [출처 9]
- Self-hosted runner 격리 및 보안 강화 [출처 13]
- **Cosign**으로 컨테이너 이미지 서명, SLSA provenance 생성 [출처 9]
- 시크릿은 GitHub Secrets 또는 Vault에만 저장, 환경 변수에 직접 노출 금지

### 4.4 Docker 컨테이너 보안

- 최소 베이스 이미지 사용 (alpine, distroless) [출처 14]
- non-root 사용자로 실행
- 멀티스테이지 빌드로 빌드 도구 제외
- 이미지 취약점 스캔을 레지스트리 레벨에서 자동화 [출처 14]
- read-only 파일시스템, no-new-privileges 설정
- 정확한 다이제스트(digest)로 이미지 pull

### 4.5 시큐어코딩 핵심 원칙 (OWASP 기반)

1. **입력 검증** — 모든 사용자 입력을 검증하고 새니타이즈 [출처 6]
2. **매개변수화 쿼리** — SQL Injection 방지를 위해 Prepared Statement 사용 [출처 6]
3. **인증/인가** — JWT + bcrypt, RBAC 적용, 세션 관리
4. **시크릿 관리** — 환경 변수 또는 Vault, 코드에 하드코딩 금지 [출처 9]
5. **에러 처리** — 민감 정보를 에러 메시지/로그에 노출하지 않음 [출처 6]
6. **의존성 관리** — 정기적 업데이트, SCA 도구로 CVE 자동 검사 [출처 7]
7. **HTTPS 강제** — TLS 인증서 적용, HTTP → HTTPS 리다이렉트
8. **CORS 설정** — 화이트리스트 기반, 와일드카드(*) 사용 금지

---

## 5. 트러블슈팅 아카이브

실제 프로젝트에서 마주친 문제와 해결 과정을 기록한다. 이 경험들은 시스템 설계 시 **무엇이 실제로 깨지는가**를 알려주는 가장 값진 자산이다.

### 5.1 Mo:lib (콘텐츠 추천 앱)

**스택**: FastAPI + PostgreSQL 16 + Docker + AWS EC2 + GitHub Actions

#### [인프라] passlib + bcrypt 호환성 충돌

- **문제**: passlib의 bcrypt 백엔드가 최신 bcrypt 패키지와 호환되지 않아 인증 모듈 초기화 실패
- **원인**: passlib이 bcrypt의 내부 API(`__about__` 등)에 의존하는데, bcrypt 4.1+에서 해당 API가 제거됨
- **해결**: bcrypt 버전을 4.0.x로 고정하거나, passlib[bcrypt] 대신 직접 bcrypt 모듈 사용
- **교훈**: 의존성 체인의 내부 API 호환성을 사전에 검증하라. lock 파일로 정확한 버전을 고정하라

#### [CI/CD] pip-audit CVE 탐지와 pyasn1/python-jose 제약

- **문제**: pip-audit이 pyasn1의 CVE를 탐지했으나, python-jose가 특정 pyasn1 버전을 요구해 업그레이드 불가
- **해결**: pip-audit을 detect-only 모드로 설정하고, CVE를 수동 평가 후 allowlist에 등록. python-jose의 대안(PyJWT) 검토
- **교훈**: SCA 도구는 detect-only로 시작하고, 점진적으로 block 모드로 전환하라

#### [보안] gitleaks-action@v2 시크릿 스캔

- **설정**: GitHub Actions에 gitleaks-action@v2 통합, ALADIN_TTB_KEY 등 API 키 노출 감시
- **판단**: detect-only 모드로 운영. 오탐(false positive) 관리를 위해 .gitleaksignore 파일 활용
- **교훈**: 시크릿 스캔은 가능한 초기에 CI/CD에 통합하되, 팀이 적응할 시간을 줘라

#### [설정] Ruff 린터 설정 분리

- **결정**: ruff.toml을 pyproject.toml과 분리하여 관리
- **근거**: 린터 설정이 빈번히 변경되므로, 빌드 설정과 분리하면 리뷰/변경 추적이 용이

### 5.2 Roame (여행 자동 문서화 앱)

**스택**: FastAPI + PostgreSQL + PostGIS + Docker Compose + CI/CD

#### [인프라] Docker Compose 서비스 의존성

- **문제**: `depends_on`만으로는 PostgreSQL이 실제로 쿼리를 받을 준비가 됐는지 보장하지 않음
- **해결**: healthcheck를 설정하고, depends_on에 `condition: service_healthy` 조건 추가
- **교훈**: 컨테이너가 '시작됨'과 '준비됨'은 다르다. healthcheck는 선택이 아니라 필수

#### [네트워크] tcpdump + curl 트러블슈팅 (K.Knock 세션 3 연계)

- **문제**: tcpdump로 패킷을 캡처한 파일이 비어 있거나 깨짐
- **원인**: tcpdump가 정상 종료(Ctrl+C)되지 않으면 pcap 파일에 데이터가 플러시되지 않음
- **해결**: 반드시 Ctrl+C로 종료 후 파일 확인. curl on Linux에서는 URL에 싱글 쿼트 사용(셸 파싱 에러 방지)

#### [DB] PostGIS ERD 설계

- **구성**: 7개 테이블, PostGIS 공간 데이터 타입 활용
- **교훈**: 공간 데이터는 일반 인덱스가 아니라 GiST 인덱스를 사용해야 성능이 나온다. PostgreSQL의 확장 생태계가 이런 특수 요구사항을 커버한다

---

## 6. 역량 성장 로드맵

### 6.1 필수 학습 자료

| 카테고리 | 자료 | 비고 |
|----------|------|------|
| **시스템 디자인 기초** | System Design Primer (GitHub) [출처 16], Grokking System Design | 분산 시스템 기초 개념 |
| **아키텍처 패턴** | Martin Fowler - Patterns of Enterprise Application Architecture | 모듈화, DDD 기초 |
| **DB 심화** | Use The Index, Luke! / PostgreSQL 공식 문서 | 인덱스 설계, 쿼리 최적화 |
| **인프라/DevOps** | Docker Deep Dive, Kubernetes Up & Running | 컨테이너 오케스트레이션 |
| **보안** | OWASP Top 10, OWASP Cheat Sheet Series | 웹 보안 필수 참조 |
| **CI/CD** | GitHub Actions 공식 문서, Wiz CI/CD Security Report [출처 13] | 파이프라인 보안 |
| **클라우드** | AWS Well-Architected Framework | 클라우드 설계 원칙 |
| **실전 연습** | Uber/Netflix/Pinterest Engineering Blog [출처 16] | 대규모 시스템 사례 |
| **블로그/커뮤니티** | High Scalability, InfoQ, Thoughtworks Radar [출처 1] | 트렌드 추적 |

### 6.2 커리어 트랙별 집중 영역

#### Platform Engineer / SRE (주 트랙)

- Kubernetes, Terraform, Ansible 실무 경험
- 모니터링: Prometheus + Grafana + ELK/Loki
- SLO/SLI/SLA 설계 및 에러 버짓 관리
- Incident Response: Postmortem 문화, Runbook 작성

#### Security Engineer (병렬 트랙)

- OWASP Top 10 실습, BurpSuite / Wireshark 활용 (K.Knock 연계)
- AI 기반 취약점 탐지 도구 동향 파악 (Wordfence, KISA, AISLE)
- 침투 테스트 방법론: PTES, OWASP Testing Guide
- 보안 자격증: CSTS(합격) → 정보보안기사 → CEH / OSCP

#### 장기 목표

- DX Engineer: 개발자 경험 최적화, 내부 도구/플랫폼 구축
- ML Engineer / AI PM: Mo:lib 추천 시스템 경험 확장

---

## 7. 체크리스트

### 7.1 아키텍처 설계 체크리스트

- [ ] FR/NFR 요구사항 정의 완료
- [ ] 규모 추정 (DAU, QPS, 저장 용량) 계산
- [ ] ERD / 데이터 모델 설계
- [ ] DB 선정 근거 ADR 작성
- [ ] API 명세서 작성 (OpenAPI/Swagger)
- [ ] 고수준 아키텍처 다이어그램 작성
- [ ] 캐싱 전략 결정 (Redis / CDN / Application-level)
- [ ] 로드밸런싱 전략 결정
- [ ] 비동기 처리 필요 여부 (Message Queue) 판단
- [ ] 트레이드오프 분석 및 ADR 문서화

### 7.2 인프라 & DevOps 체크리스트

- [ ] Docker Compose / Kubernetes 설정 완료
- [ ] healthcheck 설정 (DB, 앱 서버 모두)
- [ ] 환경 변수 관리 (.env, Secrets Manager)
- [ ] CI/CD 파이프라인 구성 (build → test → scan → deploy)
- [ ] DB 마이그레이션 도구 설정 (Alembic / Flyway)
- [ ] 로깅 & 모니터링 설정 (구조화된 로그, 알림)
- [ ] 백업 & 복구 전략 수립
- [ ] 롤백 전략 정의

### 7.3 보안 체크리스트

- [ ] HTTPS 강제 적용
- [ ] 인증/인가 구현 (JWT + bcrypt, RBAC)
- [ ] 입력 검증 & 새니타이제이션
- [ ] 시크릿 스캔 (gitleaks) CI/CD 통합
- [ ] 의존성 취약점 스캔 (pip-audit / npm audit)
- [ ] 컨테이너 이미지 스캔 (Trivy)
- [ ] CORS 화이트리스트 설정
- [ ] 에러 메시지에 민감 정보 노출 방지
- [ ] EC2 포트 관리 (최소 포트만 오픈)
- [ ] Rate Limiting 설정
- [ ] GitHub Actions 액션 SHA 고정

---

## 8. 시스템 설계 프롬프트

### 8.1 종합 시스템 설계 프롬프트

```
당신은 시니어 소프트웨어 아키텍트이자 Platform Engineer입니다.
아래 프로젝트에 대해 시스템 아키텍처를 설계해주세요.

## 프로젝트 개요
- 프로젝트명: [이름]
- 핵심 기능: [1줄 설명]
- 예상 사용자 규모: [DAU/MAU]
- 팀 규모: [인원 수]
- 기술 스택 제약: [있으면 명시]
- 예산/인프라 제약: [AWS Free Tier / EC2 단일 인스턴스 등]

## 요청 사항
다음 순서로 설계해주세요:
1. FR/NFR 정의 및 규모 추정 (Back-of-envelope)
2. 데이터 모델 & DB 선정 (근거 포함, ADR 형식)
3. API 설계 (주요 엔드포인트, 인증 방식)
4. 고수준 아키텍처 다이어그램 (텍스트 기반)
5. DevSecOps 파이프라인 (CI/CD + 보안 스캔 단계)
6. 확장성 전략 (캐싱, 로드밸런싱, 비동기 처리)
7. 트레이드오프 분석 (내 설계의 약점과 대안)

## 제약 조건
- 소규모 팀(3~5명)이 운영 가능한 수준으로 설계
- Docker 기반 컨테이너화 필수
- GitHub Actions CI/CD 파이프라인 포함
- 보안: HTTPS, JWT 인증, 시크릿 스캔, 의존성 스캔 필수
- PostgreSQL 우선 (ACID 필요 시), 근거 기반 DB 선정
- 각 결정에 ADR(Architecture Decision Record) 형식 근거 포함
```

### 8.2 빠른 설계 검토 프롬프트

```
현재 [프로젝트명]의 아키텍처를 검토해주세요. 아래 관점에서 피드백을 주세요:
1. Single Point of Failure는 어디인가?
2. 보안 취약점은 무엇인가? (OWASP Top 10 기준)
3. 10배 트래픽 증가 시 어디가 먼저 병목이 되는가?
4. 비용 최적화 기회는 어디인가?
5. 현재 팀 규모로 운영 가능한 복잡도인가?
```

### 8.3 트러블슈팅 기록 프롬프트

```
다음 트러블슈팅을 문서화해주세요:
- 증상: [무엇이 잘못됐는가]
- 환경: [OS, 도구 버전, 설정]
- 시도한 것: [무엇을 해봤는가]
- 에러 로그: [관련 로그]

형식: 문제 → 원인 → 해결 → 교훈 → 재발 방지 조치
```

---

## 9. 출처 및 참고자료

| 번호 | 출처 | URL |
|------|------|-----|
| 1 | System Design Statistics & Trends 2025 (systemdesignhandbook.com) | https://www.systemdesignhandbook.com/guides/system-design-statistics-and-trends/ |
| 2 | Cloud Architecture 2025: Future Trends, TOGAF Standards (Medium) | https://medium.com/@reiqwan/cloud-architecture-2025-future-trends-togaf-standards |
| 3 | IT Infrastructure Architecture: Modern Enterprise Design Patterns (Tracy Rivas) | https://www.tracyrivas.com/blog/it-infrastructure-architecture-modern-enterprise-design-patterns |
| 4 | 7 System Design Trends in 2025 (Educative) | https://www.educative.io/newsletter/system-design/top-system-design-trends-in-2025 |
| 5 | Top 6 DevSecOps Best Practices for 2025 (Dev-doc) | https://dev-doc.io/top-6-devsecops-best-practices-for-2025/ |
| 6 | Secure Coding Practices 2025: Top 10 Tips (OnlineHashCrack) | https://www.onlinehashcrack.com/guides/best-practices/secure-coding-practices-2025-top-10-tips |
| 7 | DevSecOps Best Practices: A 6-Step Guide (Veracode) | https://www.veracode.com/blog/devsecops-best-practices-sdlc/ |
| 8 | Security-as-Code in 2025 (AI-Infra-Link) | https://www.ai-infra-link.com/security-as-code-in-2025-best-practices-and-future-trends-for-devsecops/ |
| 9 | CI/CD Pipeline Security Tools, Standards (Fidelis Security) | https://fidelissecurity.com/threatgeek/cloud-security/ci-cd-pipeline-security-tools-and-technologies/ |
| 10 | PostgreSQL vs MySQL: 9 Key Criteria (Stitch) | https://www.stitchdata.com/resources/postgresql-vs-mysql/ |
| 11 | PostgreSQL vs MySQL: Database Selection Guide 2026 (DEV Community) | https://dev.to/_d7eb1c1703182e3ce1782/postgresql-vs-mysql-database-selection-guide-for-developers-2026 |
| 12 | PostgreSQL vs MySQL: Key Differences (Estuary) | https://estuary.dev/blog/postgresql-vs-mysql-differences-use-cases/ |
| 13 | CI/CD Security Best Practices (Wiz) | https://www.wiz.io/academy/application-security/ci-cd-security-best-practices |
| 14 | Docker in CI/CD Pipelines Guide (MOSS) | https://moss.sh/deployment/docker-in-ci-cd-pipelines-guide/ |
| 15 | The Complete System Design Interview Guide 2026 (systemdesignhandbook.com) | https://www.systemdesignhandbook.com/guides/system-design-interview/ |
| 16 | System Design Interview Guide 2026 (DesignGurus) | https://www.designgurus.io/blog/complete-guide-sys-design |

---

> 이 문서는 프로젝트마다 업데이트하여 살아있는 문서로 유지할 것.  
> 트러블슈팅은 발생 즉시 기록하고, 트렌드는 분기별로 리뷰할 것.
