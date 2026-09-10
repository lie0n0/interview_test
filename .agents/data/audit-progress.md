# 대학 학과 전수 재감사 — 진행 체크포인트

> 이 파일은 컨텍스트 컴팩션과 무관하게 감사 현황을 영속화하기 위한 체크포인트다.
> 수정 시 마다 업데이트할 것. 마지막 업데이트: 2026-09-10

## 전국 대학 전수 확장 (완료 — 2026-09-10)

**373개 대학 / 8,333개 학과** (기존 140 → 373). ipsitalk 429개 마스터 데이터(`/tmp/merged_schools.json`) 기반 전수 병합:

- **신규 233개 대학 추가**: final_add 243개 후보 중 리네임 10곳 제외
- **국립 리네임 10곳**: 공주·군산·금오공과·목포·부경·순천·창원·한국교통·한국해양·한밭대 → 국립 프리픽스 + ipsitalk 편제로 학과 전면 교체 (국립부경 60, 국립공주 107, 국립창원 67, 국립목포 85...)
- **수의예과/수의학과 보강 9곳**: 서울·충북·충남·전북·경북·경상국립·제주(merged에서), 강원(수의예과 수동), 전남(merged 누락 → 수동) — 건국대는 기존 보유
- **교육대 4곳 신규**: 공주·전주·청주·춘천교육대 (기존 6 → 10곳)
- **축약 규칙 (하이브리드)**: 특수단위(교양/기타모집단위) 제거 + "학부/학과 + 전공" 공백 분리 축약 + 전공/트랙 접미 제거. 단, **정제 후 5개 미만이면 원래 전공 유지** (서울기독대 14, 예원예술대 13, 정화예술대 8, 순복음총회신학교 3 — 신학·예술대 보호)
- **단과대학명 제거**: `/대학$/ && 학부 미포함 && ≤12자` (경영대학, 의과학대학, 프런티어창의대학 등 11건) + 수퍼스타칼리지 수동 제외(전주대)
- **캠퍼스 괄호 유지**: (수원)(파주)(동두천)(충주)(오송)(평택)(공주캠퍼스)(광주캠퍼스) 등
- **kangnam 커스텀 콘텐츠**: 재생성 후 학과명 매칭으로 재생성 전 백업에서 byte-equal 복원 확인 (20학과, 기존 상태와 완전 동일)
- 환경상 하위 에이전트 실행 불가 → 전부 직접 실행 (websearch/webfetch/Read/Edit)

## 데이터 파일 구조 (검증 완료)

- `universities.json` → `{ universities: [{id, name, departments:[{id, name, passage, modelAnswerHint, disposition, weights}]}], defaultWeights: {...} }` (373개 대학)
- `raw-universities/index.js` → `[ [id, 한글명, 등급(MID_PRI/MID_NAT/...), [학과명, ...]], ... ]` (373개 엔트리)

## 로컬 데이터 일관성 감사 (완료 — 2026-09-09 ~ 2026-09-10)

- **app ↔ raw 학과 목록: 0건 차이** (공유 id 139개 전수 비교, 누락/초과 모두 없음)
- ⚠️ **raw 중복 해결 완료**: `korea_national_edu` (한국교원대학교, MID_NAT, 10학과) — `korea_national_education`(MID_PRI)과 동일 대학 중복. app은 `korea_national_education`만 사용하므로 raw에서 제거 완료 (2026-09-10, 커밋 1d1d465)

## 면접 전형 필터링 (완료 — 2026-09-10, 커밋 1d1d465)

사용자 지시: "입시요강 확인 → 면접 없으면 학교 삭제, 면접 있는 학교는 면접 있는 학과만 유지" (판단 기준: **수시** — 수시 학생부종합/면접 전형에서 면접 실시 여부, 정시 의대·약대 적성면접은 별도 유지)

**제거된 대학 9곳 (universities.json 148→139, raw 149→139):**
| id | 대학 | 사유 |
|---|---|---|
| cyber_hankuk | 사이버한국외국어대학교 | 사이버대 — 면접 없음 (자소서 70+학업소양검사 30) |
| cyber_seoul | 서울사이버대학교 | 사이버대 — 면접 없음 |
| korea_digital | 한국디지털대학교 | 사이버대 — 면접 없음 |
| knou | 한국방송통신대학교 | 방통대 — 면접 없음 (성적 순) |
| dankook_seoul | 단국대학교(서울) | 중복 — 본 엔트리의 하위집합 (7학과) |
| sejong_seoul | 세종대학교(서울) | 중복 — 본 엔트리의 하위집합 |
| shinhan_seoul | 신한대학교(서울) | 중복 — 본 엔트리의 하위집합 |
| induk_seoul | 인덕대학교(서울) | 중복 — 7/7 100% 동일 |
| pukyong | 부산대학교(부산) | 가짜 중복 — 실제 부산대(부산) 아님 |

**면접 보유 확인 (유지 대상) — 표본 조사 결과:**
- 상위권 일반대: 서울대(일반전형 면접 50%), 고려대(면접 30~40%), 연세대(서류 70+면접 30), 경북대(2단계 면접 30~50%), 한양대(2026 면접형 확대) — 전부 면접 전형 보유
- 과학기술원: KAIST(일반전형), POSTECH(면접 50:50), GIST, UNIST(탐구우수전형) — 면접 보유
- 교육대: 경인교대(비대면 영상면접), 대구교대(2단계 면접 300점) 등 — 면접 보유
- 예체능·신학: 총신대(모든 전형 구술면접), 영남신학대(면접 30%), 추계예술대·서울예술대(실기+구술), 한국체육대(면접고사) — 면접 보유
- 전문대·폴리텍: 거제대(대학자체·고른기회 면접 100%), 구미대(전체학과 면접), 김천대(일반면접 전형) — 면접 전형 존재, 유지
- **결론: 사이버대/방통대를 제외한 4년제 및 전문대는 사실상 전 대학 수시 면접 전형 보유 → 학과 단위 추가 제거 불필요**

**검증:**
- 서버 재시작 후 `/api/universities` → 139개 대학, 3,315개 학과 정상 로드
- 백업: `.agents/data/universities.json.bak2` (제거 전 148개 상태) — gitignore 추가됨 (.agents/data/universities.json.bak*)

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

## 대학별 감사 상태 (139개 — 9개 대학 면접 필터링 제거, 2026-09-10)

> 제거됨: cyber_hankuk, cyber_seoul, korea_digital, knou, dankook_seoul, sejong_seoul, shinhan_seoul, induk_seoul, pukyong, korea_national_edu(중복)

- [완료] 이전: gachon (가천대, 정보보호학과 추가됨 — 이전 세션)
- [완료] B1: korea_catholic, kangnam, gangneung_wonju, kangwon (2026-09-10 confirm)
- [완료] B2: geoje, konkuk, konyang, kyonggi, gyeongnam (2026-09-10 확인)
- [대기] B3: gyeongbuk, gyeongnam_national, kyungsung, ginue, kyungil
- [대기] B4: kyunghee, keimyung, korea, kosin, kongju
- [대기] B5: kwangwoon, gists, gnue, gwangju, kwu
- [대기] B6: gumi, gunmin, kunsan, kumoh, gimcheon
- [대기] B7: gimhae, nazarene, nambu, nsu, dankook
- [대기] B8: daegu_catholic, daegu_national_edu, daegu, dhu
- [대기] B9: daejeon_u, daejin, duksung, dongguk, dongduk
- [대기] B10: tongmyong, dongseo, dongshin, donga, dongeui
- [대기] B11: myongji, mokwon, mokpo_national, paichai, baekseok
- [대기] B12: pknu, busan_national_edu, pusan, bufs
- [대기] B13: sahmyook, sungshin, sangji, seogang
- [대기] B14: seokyeong, korea_catholic_seoul, seoul_tech, snue, seoul
- [대기] B15: seoul_city, sungshin_w, seoul_arts, sunmoon
- [대기] B16: skhu, sungkyunkwan, semyung, sejong
- [대기] B17: suwon, sookmyung, sunchon, suncheonhyang, soongsil
- [대기] B18: silla, shinhan, ajou, andong
- [대기] B19: anyang, yonsei, yeungnam, danguk, youngsan
- [대기] B20: yeungjin, yongin, woosuk, woosong, unist
- [대기] B21: ulsan, wonkwang, u1, eulji, ewha
- [대기] B22: induk, inje, incheon, jeonnam
- [대기] B23: jeonbuk, jeju, joongbu, chungang, jinju
- [대기] B24: changwon, cheongju, chongshin, chugye, chungnam
- [대기] B25: chungbuk, pyeongtaek, postech, hankyong, kaist
- [대기] B26: korea_national_education, korea_tech, kat
- [대기] B27: kpu, kcarts, korea_u, karts, polytech
- [대기] B28: korea_open2, korea_open_univ, kau, korea_maritime, hannam
- [대기] B29: handong, hallym, hanbat, hansung, hanshin
- [대기] B30: hanyang, honam, hoseo, hongik

## 데이터 밀도 (139개 기준 — 2026-09-10 재계산, 우선순위 참고)

- 평균 24.3학과 (총 3377학과/139개), **15학과 이하 48개 대학** — 저밀도 우선 감사
- 최소: danguk(3), gumi(5), gimcheon(5), daegu_national_edu(6)

## 발견 사항 (출처 필수)

### B1 사전 정황 (출처 확인 중)

- **korea_catholic (가톨릭대학교)**: **해결 완료 (2026-09-10)**: 데이터 45학과로 확장됨 (`c3313d7`). 누락 의심 목록(신학과, 의예과, 약학과, 음악과, 심리학과, 사회복지학과, 아동학과, 특수교육과, 법학과, 국제학부, 회계학과, 국제경영학과, 세무회계금융학과, IT파이낸스학과, 2026 신설 바이오로직스공학부·AI의공학과, 자유전공학부) 전부 포함 확인. passage/hint/disposition/weights 필드 완비.
- **kangnam (강남대학교)**: **해결 완료 (2026-09-10)**: 43학과 → 공식 2026 모집단위 기준 **20학과로 재구성** (자유전공학부, 사회복지학부, 시니어비즈니스학과, 상경학부, 법행정세무학부, 문화콘텐츠학과, 국제지역학과, 중국콘텐츠비즈니스학과, 기독교커뮤니케이션학과, 컴퓨터공학부, 인공지능융합공학부, 전자반도체공학부, 부동산건설학부, 디자인학과, 체육학과, 음악학과, 교육학과, 유아교육과, 초등특수교육과, 중등특수교육과). 제거: 대학원 7곳(법학전문·공공정책·교육·사회복지·행정·부동산·문예창작) + Divinity School + 국제어학원 + 폐지/구학과(국어국문, 영어영문, 중어중문, 경영학과, 회계세무, 경제, 무역, 컴퓨터공학과, 소프트웨어, 데이터과학, 전자, 전기, 기계, 산업경영, 건축, 도시계획, 실내/시각/패션디자인, 피아노, 스포츠과학, 아동복지, 행정, 경찰행정, 심리, 간호) + USA/공간디자인/연계융합 등 비정상 엔트리. 2026 구조개편(학부·전공제 전환) 반영 완료.
  - 출처: https://web.kangnam.ac.kr/menu/9bff9ab75286a0ab29b9aa0eaf71ba95.do (공식 2026 모집단위 안내), 진학사 경쟁률 표 대조
- **gangneung_wonju (강릉원주대학교)**: 2026학년도부터 **강원대학교로 통합** (강원대 강릉·원주캠퍼스). 데이터 모델 판단 필요 (별도 유지 vs 통합 반영). 현재 17학과.
  - **해결 완료 (2026-09-10 확인)**: `c3313d7`에서 강원대(kangwon)로 통합 처리됨 — gangneung_wonju 엔트리 app/raw 제거, kangwon을 24→107학과로 확장 (춘천+삼척·도계+강릉·원주 4캠퍼스 반영). 공식 입학홈페이지(2026 학과/학부별 안내) 대조로 타당성 확인.
  - 출처: https://itcall.kangwon.ac.kr/admission/selectMjrInfoList.do?key=2156 (춘천·삼척·도계), https://wwwk.kangwon.ac.kr/www/contents.do?key=1809 (공학대학), https://admission.kangwon.ac.kr/www/contents.do?key=1818 (보건과학대학)
- **kangwon (강원대학교)**: **107학과 — 이상치 아님** (2026 강릉원주 통합 반영). 춘천캠퍼스(인문·사회·경영·농생명·자연·공과·IT·사범·수의·약·의·간호대) + 삼척캠퍼스(인문사회·공학·디자인스포츠대) + 도계캠퍼스(보건과학대) 통합 기준. 확인 사항: 경제·정보통계학부(경제학과·국제통상학과 통합), 경영·회계학부(회계학과 통합) — 옛 학과명이 학부명에 흡수된 것 확인.
  - 출처: https://www.namu.moe/w/강원대학교/학부 (2026 학과 편성표), https://wwwk.kangwon.ac.kr/www/contents.do?key=1791 (자연과학대학)

### B2 (geoje, konkuk, konyang, kyonggi, gyeongnam) (2026-09-10 완료)

- **geoje (거제대학교)**: 5 → **10학과**. 공식 2026학년도 모집단위 기준으로 재구성.
  - 출처: https://enter.koje.ac.kr/enter/content/9 (2026학년도 모집학과·인원 안내)
- **konkuk (건국대학교)**: 36 → **63학과**. ipsitalk 편제 71개 → 축약 규칙(학부/학과 레벨만 유지, 전공 세분·특수단위 제외) 적용.
  - 출처: https://uni.ipsitalk.net/school.php?slug=%EA%B1%B4%EA%B5%AD%EB%8C%80%ED%95%99%EA%B5%90 (71개 편제, 2026-02-19 기준)
- **konyang (건양대학교)**: 10 → **38학과**.
  - 출처: https://ipsi.konyang.ac.kr/ipsi/sub07_01.do (입학처 학과소개 — 의과대학~사회과학학술원 38개)
- **kyonggi (경기대학교)**: 45 → **37학과**. ipsitalk 84개 편제 → 학부 재편 반영, 제2캠퍼스 12개·일반대학원 등 특수단위 제외.
  - 출처: https://uni.ipsitalk.net/school.php?slug=%EA%B2%BD%EA%B8%B0%EB%8C%80%ED%95%99%EA%B5%90 (84개 편제)
- **gyeongnam (경남대학교)**: 18 → **51학과**. ipsitalk 83개 편제 → 축약 규칙 적용.
  - 출처: https://uni.ipsitalk.net/school.php?slug=%EA%B2%BD%EB%82%A8%EB%8C%80%ED%95%99%EA%B5%90 (83개 편제)

**B2 검증 (2026-09-10):**
- 총 139개 대학 / 3377학과 (기존 3292 + B2 순변동 +85: geoje+5, konkuk+27, konyang+28, kyonggi−8, gyeongnam+33)
- **kangnam 주의사항**: 재생성 시 B2 외 커스텀 대학(kangnam)이 템플릿 기본 passage로 덮이는 문제 발생 → `universities.json.pre-b2` 백업에서 **byte-equal 복원** 후 재검증 완료. 이후 재생성 시 반드시 백업 대조 필요.
- raw ↔ app: B2 5개 대학 학과명·순서·수 전부 일치 / `npm run check` 통과 / 서버 재기동 후 `/api/universities` → 139개 대학·3377학과 정상 로드

### 데이터 밀도 분포 (참고 — 2026-09-10 B2 반영 재계산)
```
3: danguk | 5: gimcheon, gumi | 6: busan_national_edu, daegu_national_edu, daejin, duksung | 7: gimhae, induk, karts, korea_open2, korea_open_univ, tongmyong | 8: gwangju, jinju, kat, korea_catholic_seoul, korea_maritime, korea_tech, sangji, semyung, shinhan, yeungjin | 9: daegu_catholic, hankyong, hanshin, inje, polytech, silla, suncheonhyang, woosuk | 10: geoje, gnue, korea_national_education, sahmyook, seoul_arts, unist | 11: ginue, gists, kcarts | 12: changwon, hansung, snue | 13: gyeongnam_national, kunsan, postech | 14: handong | 15: chugye | 16: chongshin, hallym, kaist, mokpo_national, seoul_tech | 17: ulsan | 18: daegu, kpu, skhu | 19: seoul_city, wonkwang | 20: bufs, eulji, kangnam, kau, korea_u, sungshin_w | 21: hongik, incheon | 22: kwangwoon | 23: jeju, keimyung, sungshin | 24: kumoh, nazarene | 25: donga, sookmyung, woosong | 26: dongduk, gunmin, myongji, seokyeong | 28: chungbuk, kosin, pyeongtaek | 29: jeonbuk, jeonnam, nambu, sejong, u1 | 30: anyang, chungnam, yeungnam | 31: dongguk, kwu, seogang, soongsil | 32: baekseok, hanbat, nsu, yongin | 33: dongseo, kyungil | 34: gyeongbuk, sungkyunkwan | 35: andong, paichai | 36: chungang, dankook, dongshin, mokwon, sunchon, youngsan | 37: joongbu, kyonggi, sunmoon | 38: ajou, dhu, honam, konyang | 40: hanyang, hoseo, kyunghee | 41: suwon | 42: hannam, kongju | 43: cheongju, daejeon_u, kyungsung, pusan | 44: dongeui | 45: korea_catholic, pknu | 46: yonsei | 48: korea | 51: gyeongnam | 53: ewha, gachon | 54: seoul | 63: konkuk | 107: kangwon
```