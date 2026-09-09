# 대학 학과 전수 재감사 — 진행 체크포인트

> 이 파일은 컨텍스트 컴팩션과 무관하게 감사 현황을 영속화하기 위한 체크포인트다.
> 수정 시 마다 업데이트할 것. 마지막 업데이트: 2026-09-09

## 데이터 파일 구조 (검증 완료)

- `universities.json` → `{ universities: [{id, name, departments:[{id, name, passage, modelAnswerHint, disposition, weights}]}], defaultWeights: {...} }` (149개 대학)
- `raw-universities/index.js` → `[ [id, 한글명, 등급(MID_PRI/MID_NAT/...), [학과명, ...]], ... ]` (150개 엔트리)

## 로컬 데이터 일관성 감사 (완료 — 2026-09-09)

- **app ↔ raw 학과 목록: 0건 차이** (공유 id 149개 전수 비교, 누락/초과 모두 없음)
- ⚠️ **raw 중복 발견**: `korea_national_edu` (한국교원대학교, MID_NAT, 10학과) — `korea_national_education`(MID_PRI)과 동일 대학 중복. app은 `korea_national_education`만 사용.
  - 처리: B30 배치에 포함해 제거 예정. (참조 확인 필요: 모델/프롬프트/테스트)

## 위임 인프라 장애 진단 (중요 — 반복 시도 금지)

- 백그라운드 librarian 배치 30건 + 이전 15건 전원 타임아웃/실행 안 됨 (30분 inactivity, 세션 메시지 0건)
- **동기(sync) librarian 테스트도 동일하게 30분 inactivity 타임아웃, 출력 0건** → 하위 에이전트 실행 자체가 환경에서 동작하지 않음
- 결론: **배치 재시도 금지. 감사는 직접 실행 (본 세션의 websearch/webfetch/Read/Edit 사용)**
- 남은 좀비 백그라운드 태스크 개별 에러 알림은 무시 가능 (bg_1e014987, bg_0cc2316d 취소 완료)

## 감사 방법론

1. 대학별 현재 데이터 학과 목록 추출 (universities.json)
2. 공식 출처 웹 검색: 입학처 학과안내, 수시모집요강 PDF, 대학 홈페이지 단과대학·학과 페이지
3. 데이터 vs 실존 비교 → 누락 식별. **추측 금지, 출처 URL 필수**
4. 확정 누락 → `universities.json`(departments 배열 + QA 콘텐츠) **그리고** `raw-universities/index.js`(학과명만) 양쪽에 반영
   - 두 레이어 동기화 유지가 핵심 (로컬 감사 기준)
5. 각 대학 완료 시 아래 상태표를 `[완료]`로 갱신

## 대학별 감사 상태 (149개)

- [완료] 이전: gachon (가천대, 정보보호학과 추가됨 — 이전 세션)
- [진행중] B1: korea_catholic, kangnam, gangneung_wonju, kangwon
- [대기] B2: geoje, konkuk, konyang, kyonggi, gyeongnam
- [대기] B3: gyeongbuk, gyeongnam_national, kyungsung, ginue, kyungil
- [대기] B4: kyunghee, keimyung, korea, kosin, kongju
- [대기] B5: kwangwoon, gists, gnue, gwangju, kwu
- [대기] B6: gumi, gunmin, kunsan, kumoh, gimcheon
- [대기] B7: gimhae, nazarene, nambu, nsu, dankook
- [대기] B8: dankook_seoul, daegu_catholic, daegu_national_edu, daegu, dhu
- [대기] B9: daejeon_u, daejin, duksung, dongguk, dongduk
- [대기] B10: tongmyong, dongseo, dongshin, donga, dongeui
- [대기] B11: myongji, mokwon, mokpo_national, paichai, baekseok
- [대기] B12: pknu, busan_national_edu, pusan, pukyong, bufs
- [대기] B13: cyber_hankuk, sahmyook, sungshin, sangji, seogang
- [대기] B14: seokyeong, korea_catholic_seoul, seoul_tech, snue, seoul
- [대기] B15: cyber_seoul, seoul_city, sungshin_w, seoul_arts, sunmoon
- [대기] B16: skhu, sungkyunkwan, semyung, sejong, sejong_seoul
- [대기] B17: suwon, sookmyung, sunchon, suncheonhyang, soongsil
- [대기] B18: silla, shinhan, shinhan_seoul, ajou, andong
- [대기] B19: anyang, yonsei, yeungnam, danguk, youngsan
- [대기] B20: yeungjin, yongin, woosuk, woosong, unist
- [대기] B21: ulsan, wonkwang, u1, eulji, ewha
- [대기] B22: induk, induk_seoul, inje, incheon, jeonnam
- [대기] B23: jeonbuk, jeju, joongbu, chungang, jinju
- [대기] B24: changwon, cheongju, chongshin, chugye, chungnam
- [대기] B25: chungbuk, pyeongtaek, postech, hankyong, kaist
- [대기] B26: korea_national_education, korea_tech, kat, korea_digital, knou
- [대기] B27: kpu, kcarts, korea_u, karts, polytech
- [대기] B28: korea_open2, korea_open_univ, kau, korea_maritime, hannam
- [대기] B29: handong, hallym, hanbat, hansung, hanshin
- [대기] B30: hanyang, honam, hoseo, hongik (+ korea_national_edu 중복 제거)

## 데이터 밀도 (우선순위 참고)

- 평균 21.9학과, 중앙값 20, 최대 54 (seoul), **15학과 이하 59개 대학** — 저밀도 우선 감사
- 최소: danguk 3, geoje 5, gumi 5, gimcheon 5

## 발견 사항 (출처 필수)

### B1 사전 정황 (출처 확인 중)

- **korea_catholic (가톨릭대학교)**: 데이터 10학과. 공식 입학처 학과안내 대비 대규모 누락 의심: 신학과, 의예과, 약학과, 음악과, 심리학과, 사회복지학과, 아동학과, 특수교육과, 법학과, 국제학부, 회계학과, 세계지역?, 글로벌경영대학(국제경영학과/세무회계금융학과/IT파이낸스학과), 2026 신설 바이오로직스공학부·AI의공학과, 자유전공학부 등.
  - 출처: https://ipsi.catholic.ac.kr/submenu.do?categoryid=2 (학과안내), https://www.catholic.ac.kr/ko/academics/edu_undergraduate1.do (인문사회계열), 2026 수시모집요강 PDF (megastudy/sanedu)
- **kangnam (강남대학교)**: 학사구조개편으로 학부·전공제 전환 확인 (복지융합대학 사회복지학부/시니어비즈니스학과, 경영관리대학 상경학부/법행정세무학부, 글로벌문화콘텐츠대학 문화콘텐츠학과/국제지역학과, 자유전공학부, 교육학과). 데이터는 구학과명 기반(경영학과, 회계세무학과 등) — 명칭 변경 대응 판단 필요.
  - 출처: https://web.kangnam.ac.kr/menu/9bff9ab75286a0ab29b9aa0eaf71ba95.do
- **gangneung_wonju (강릉원주대학교)**: 2026학년도부터 **강원대학교로 통합** (강원대 강릉·원주캠퍼스). 데이터 모델 판단 필요 (별도 유지 vs 통합 반영). 현재 17학과.
  - 출처: https://www.gwnu.ac.kr/iphak/index.do ("1일 통합 강원대학교 출범"), https://tourism.gwnu.ac.kr/iphak/7638/subview.do (전공안내)
- **kangwon (강원대학교)**: 춘천캠퍼스 기준 경영·회계학부, 경제·정보통계학부, IT대학(AI융합학과, 디지털밀리터리학과 등), 삼척·도계 보건과학대학 9개 학과 등 대규모 누락 의심. 현재 24학과.
  - 출처: https://wwwk.kangwon.ac.kr/www/contents.do?key=1794 (IT대학), https://admission.kangwon.ac.kr/www/contents.do?key=1818 (보건과학대학)

### 데이터 밀도 분포 (참고)
```
3: danguk | 5: geoje, gumi, gimcheon | 6: daegu_national_edu, daejin, duksung, busan_national_edu, cyber_hankuk, sejong_seoul, shinhan_seoul, korea_digital | 7: gimhae, dankook_seoul, tongmyong, induk, induk_seoul, knou, karts, korea_open2, korea_open_univ | 8: gwangju, sangji, korea_catholic_seoul, cyber_seoul
```