# VoiceConnect Campaign - PROJECT HISTORY & CURRENT STATUS

이 문서는 프로젝트 시작부터 현재까지의 주요 수정 사항과 시스템 상태를 기록합니다.

## 🕒 프로젝트 타임라인 및 주요 수정 사항

### 1. 초기 연동 및 배포 (2026.02)
- **Firebase 연동**: 초기 인증 및 데이터 관리를 위해 Firebase를 통합했습니다.
- **Vercel 배포**: Vercel을 통한 자동 배포 환경을 구축했습니다.
- **로그인 오류 수정**: Google, Naver 로그인 시 발생하는 'Access Denied' 오류를 해결하고 Prisma DB 연결을 안정화했습니다.
- **Git 충돌 해결**: 빌드 오류를 유발하던 Git merge conflict 마커를 제거했습니다.

### 2. 고도화 및 데이터 정제 (2026.03 초반)
- **중복 데이터 조사**: 특정 사용자들 간의 중복된 연락처 할당 문제를 조사하고 데이터 무결성을 점검했습니다.
- **데이터 복구**: Firebase에서 손실된 데이터를 조사하고 복구 방안을 마련했습니다.

### 3. Supabase 마이그레이션 (2026.03 중반)
- **인증 시스템 이전**: Firebase Auth에서 Supabase Auth로 마이그레이션을 진행했습니다.
- **RLS 정책 최적화**: Supabase의 Row Level Security(RLS) 정책을 도입하고 무한 재귀 오류를 해결했습니다.
- **ID 동기화 로직**: 기존 사용자 ID와 새로운 Supabase UUID 간의 불일치 문제를 해결하기 위해 `AuthContext`에 자동 동기화 로직을 도입했습니다.

### 4. 기능 개선 및 버그 수정 (2026.03 후반)
- **필터 및 엑셀 내보내기**: 담당자별 필터링 기능과 엑셀 다운로드(`xlsx`) 기능을 정상화했습니다.
- **에러 리포트 관리**: `ADMIN` 역할이 에러 리포트를 조회하고 상태를 수정할 수 있도록 접근 권한을 확장했습니다.
- **지표 개선**: 지지 정도 구분 값을 사용자 요청에 맞춰 업데이트했습니다.

### 5. 최근 작업: 로그인 및 데이터 정제 (2026-03-18)
- **로그인 장애 해결**: RLS 권한 수정을 통해 신규/기존 사용자의 로그인 및 ID 마이그레이션이 가능하도록 조치했습니다.
- **연락처 할당 시각화 수정**: 
    - 장선영님의 계정 이메일 불일치로 인해 유실되었던 연락처 할당 데이터(~300건)를 현재 사용 중인 UUID로 일괄 연결했습니다.
    - 관리자가 할당 즉시 자원봉사자 화면에 나타나지 않던 실시간 동기화 버그(`CampaignContext.jsx`)를 수정했습니다.
- **영구 가이드 마련**: 향후 유지보수를 위해 `AI_INSTRUCTIONS.md`를 생성하고 깃허브 히스토리를 업데이트했습니다.

## 🛠️ 주요 기술 스택 및 테이블 정보

### 기술 스택
- **Frontend**: React, Vite, Tailwind CSS
- **Backend/DB**: Supabase (Auth, PostgreSQL)
- **Deployment**: Vercel

### 핵심 테이블 구조
- **`users`**: 사용자 정보, 역할(`ADMIN`, `DEVELOPER`, `VOLUNTEER`, `REJECTED`, `UNAUTHORIZED`), Supabase UUID 관리.
- **`contacts`**: 캠페인 연락처 정보, `assigned_to` 필드를 통해 담당 사용자(`users.id`)와 연결.
- **`error_reports`**: 시스템 오류 신고 및 상태(`PENDING`, `FIXED`) 관리.

## 💡 유지보수 안내
모든 주요 변경 사항은 `apply_robust_rls.cjs`와 같은 자동화 스크립트와 `AI_INSTRUCTIONS.md` 가이드에 반영되어 있습니다. 추가 수정 시 해당 문서들을 먼저 참조하십시오.
