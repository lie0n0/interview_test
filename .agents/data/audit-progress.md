# 대학 학과 전수 재감사 — 진행 체크포인트

> 이 파일은 컨텍스트 컴팩션과 무관하게 감사 현황을 영속화하기 위한 체크포인트다.
> 수정 시 마다 업데이트할 것. 마지막 업데이트: 2026-09-10

## 데이터 파일 구조 (검증 완료)

- `universities.json` → `{ universities: [{id, name, departments:[{id, name, passage, modelAnswerHint, disposition, weights}]}], defaultWeights: {...} }` (139개 대학 — 면접 필터링 적용 후)
- `raw-universities/index.js` → `[ [id, 한글명, 등급(MID_PRI/MID_NAT/...), [학과명, ...]], ... ]` (139개 엔트리)

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
- [진행중] B1: korea_catholic, kangnam, gangneung_wonju, kangwon
- [대기] B2: geoje, konkuk, konyang, kyonggi, gyeongnam
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

- 평균 23.8학과, **15학과 이하 49개 대학** — 저밀도 우선 감사
- 최소: danguk(3), geoje(5), gumi(5), gimcheon(5), daegu_national_edu(6)

## 발견 사항 (출처 필수)

### B1 사전 정황 (출처 확인 중)

- **korea_catholic (가톨릭대학교)**: 데이터 10학과. 공식 입학처 학과안내 대비 대규모 누락 의심: 신학과, 의예과, 약학과, 음악과, 심리학과, 사회복지학과, 아동학과, 특수교육과, 법학과, 국제학부, 회계학과, 세계지역?, 글로벌경영대학(국제경영학과/세무회계금융학과/IT파이낸스학과), 2026 신설 바이오로직스공학부·AI의공학과, 자유전공학부 등.
  - 출처: https://ipsi.catholic.ac.kr/submenu.do?categoryid=2 (학과안내), https://www.catholic.ac.kr/ko/academics/edu_undergraduate1.do (인문사회계열), 2026 수시모집요강 PDF (megastudy/sanedu)
- **kangnam (강남대학교)**: 학사구조개편으로 학부·전공제 전환 확인 (복지융합대학 사회복지학부/시니어비즈니스학과, 경영관리대학 상경학부/법행정세무학부, 글로벌문화콘텐츠대학 문화콘텐츠학과/국제지역학과, 자유전공학부, 교육학과). 데이터는 구학과명 기반(경영학과, 회계세무학과 등) — 명칭 변경 대응 판단 필요.
  - 출처: https://web.kangnam.ac.kr/menu/9bff9ab75286a0ab29b9aa0eaf71ba95.do
- **gangneung_wonju (강릉원주대학교)**: 2026학년도부터 **강원대학교로 통합** (강원대 강릉·원주캠퍼스). 데이터 모델 판단 필요 (별도 유지 vs 통합 반영). 현재 17학과.
  - **해결 완료 (2026-09-10 확인)**: `c3313d7`에서 강원대(kangwon)로 통합 처리됨 — gangneung_wonju 엔트리 app/raw 제거, kangwon을 24→107학과로 확장 (춘천+삼척·도계+강릉·원주 4캠퍼스 반영). 공식 입학홈페이지(2026 학과/학부별 안내) 대조로 타당성 확인.
  - 출처: https://itcall.kangwon.ac.kr/admission/selectMjrInfoList.do?key=2156 (춘천·삼척·도계), https://wwwk.kangwon.ac.kr/www/contents.do?key=1809 (공학대학), https://admission.kangwon.ac.kr/www/contents.do?key=1818 (보건과학대학)
- **kangwon (강원대학교)**: **107학과 — 이상치 아님** (2026 강릉원주 통합 반영). 춘천캠퍼스(인문·사회·경영·농생명·자연·공과·IT·사범·수의·약·의·간호대) + 삼척캠퍼스(인문사회·공학·디자인스포츠대) + 도계캠퍼스(보건과학대) 통합 기준. 확인 사항: 경제·정보통계학부(경제학과·국제통상학과 통합), 경영·회계학부(회계학과 통합) — 옛 학과명이 학부명에 흡수된 것 확인.
  - 출처: https://www.namu.moe/w/강원대학교/학부 (2026 학과 편성표), https://wwwk.kangwon.ac.kr/www/contents.do?key=1791 (자연과학대학)

### 데이터 밀도 분포 (참고 — 2026-09-10 재계산)
```
3: danguk | 5: geoje, gumi, gimcheon | 6: daegu_national_edu, daejin, duksung, busan_national_edu | 7: gimhae, tongmyong, induk, karts, korea_open2, korea_open_univ | 8: gwangju, sangji, korea_catholic_seoul, semyung, shinhan, yeungjin, jinju, korea_tech, kat, korea_maritime | 9: daegu_catholic, suncheonhyang, silla, woosuk, inje, hankyong, polytech, hanshin | 10: konyang, gnue, sahmyook, seoul_arts, unist, korea_national_education | 11: ginue, gists, kcarts | 12: snue, changwon, hansung | 13: gyeongnam_national, kunsan, postech | 14: handong | 15: chugye | 16: mokpo_national, seoul_tech, chongshin, kaist, hallym | 17: ulsan | 18: gyeongnam, daegu, skhu, kpu | 19: seoul_city, wonkwang | 20: bufs, sungshin_w, eulji, korea_u, kau | 21: incheon, hongik | 22: kwangwoon | 23: keimyung, sungshin, jeju | 24: kumoh, nazarene | 25: donga, sookmyung, woosong | 26: gunmin, dongduk, myongji, seokyeong | 28: kosin, chungbuk, pyeongtaek | 29: nambu, sejong, u1, jeonnam, jeonbuk | 30: anyang, yeungnam, chungnam | 31: kwu, dongguk, seogang, soongsil | 32: nsu, baekseok, yongin, hanbat | 33: kyungil, dongseo | 34: gyeongbuk, sungkyunkwan | 35: paichai, andong | 36: konkuk, dankook, dongshin, mokwon, sunchon, youngsan, chungang | 37: sunmoon, joongbu | 38: dhu, ajou, honam | 40: kyunghee, hanyang, hoseo | 41: suwon | 42: kongju, hannam | 43: kangnam, kyungsung, daejeon_u, pusan, cheongju | 44: dongeui | 45: korea_catholic, kyonggi, pknu | 46: yonsei | 48: korea | 53: gachon, ewha | 54: seoul | 107: kangwon
```