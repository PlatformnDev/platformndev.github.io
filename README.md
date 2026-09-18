# Platformn 도구 모음

조직 사이트의 도구 목록과 브라우저 기반 이미지 배경 제거 기능을 제공하는 정적 사이트입니다. 이미지를 서버에 보내지 않습니다. Vite + TypeScript + ONNX Runtime Web으로 구성했으며 로그인, API 서버, 데이터베이스가 없습니다.

## 로컬에서 실행하기

Node.js 22.23 이상과 Git을 설치합니다. Node 설치에 포함된 npm을 사용합니다.

```sh
git clone https://github.com/PlatformnDev/platformndev.github.io.git
cd platformndev.github.io
npm ci
npm run dev
```

터미널에 표시되는 주소(기본 `http://127.0.0.1:5173/`)를 브라우저에서 엽니다. 이미지를 선택하거나 오타니 예시 버튼을 누르면 자동으로 배경을 제거합니다. 완료 후 **투명 PNG 다운로드**로 저장합니다. 종료하려면 터미널에서 `Ctrl+C`를 누릅니다.

이미 이 작업 폴더에 있다면 `git clone`과 `cd`를 생략하고 `npm ci`부터 실행합니다. 포트가 사용 중이면 터미널에 표시된 다른 포트를 사용하세요. Chrome·Edge 계열 데스크톱 브라우저를 권장하며 실제 검증 범위는 아래 검증 기록을 참고하세요.

모델 조각과 실행 파일은 `public/`에 포함되어 있어 정상 체크아웃 후 별도 모델 다운로드 없이 실행할 수 있습니다. 브라우저가 처음 실행할 때 로컬 서버에서 모델 약 176MB와 실행 자산 약 22MB를 읽습니다. 이미지 처리는 브라우저 안에서 수행합니다. 파일이 누락되었다면 `npm run prepare:model`로 복구할 수 있으며, 이 준비 명령은 인터넷에 접속합니다.

도구 목록과 `/remove-bg/`를 포함한 전체 사이트를 로컬에서 확인하려면:

```sh
npm run build:site
npm run preview:site
```

도구 목록은 `http://127.0.0.1:4173/`, 배경 제거는 `http://127.0.0.1:4173/remove-bg/`입니다. 종료는 `Ctrl+C`입니다. 테스트는 `npm test`로 실행합니다. `dist/`가 완전 정적 결과물입니다. `index.html`을 파일 탐색기에서 직접 열면 Worker·모델 로딩이 동작하지 않으므로 반드시 로컬 서버 또는 HTTPS 호스팅을 사용하세요.

## 입력과 출력

- JPG/JPEG, PNG, WebP, AVIF, BMP, GIF를 지원합니다. 브라우저에서 실제로 디코딩할 수 있어야 합니다.
- GIF, APNG, 움직이는 WebP/AVIF는 기본 이미지 또는 첫 프레임만 처리합니다. GIF와 WebP는 반복 실행으로 첫 프레임 처리를 검증했습니다.
- 파일당 20MiB, 2,500만 픽셀, 한 변 8,192픽셀까지 허용합니다. UI의 20MB는 20MiB 기준입니다.
- HEIC/HEIF, TIFF, PSD, RAW, SVG, PDF, 동영상은 지원하지 않습니다.
- 출력은 방향 보정 후 원본 크기의 PNG이며 기존 알파 값에 예측 마스크를 곱합니다. EXIF 등 원본 메타데이터는 출력에 복사하지 않습니다.
- 출력 이름은 `원본이름-no-bg.png`입니다. 일괄 처리·편집·이력 기능은 없습니다.

## 모델과 실행 방식

- 모델: `imgly/isnet-general-onnx`, FP32 `onnx/model.onnx`
- 고정 리비전: `440dea96dd4a3b06bbbf5abec3e26569dd7ec49f`
- 원본 크기: 176,149,806바이트. 최초 사용 시 모델 약 176MB와 실행 자산 약 22MB를 내려받습니다.
- SHA-256: `cc2c9f5c1751b9737cb81e708ff0c5e9542c2205daed22418a4fd2ab5d4c481a`
- 입력: RGB, 1024×1024 bilinear, `(value - 128) / 256`, NCHW.
- 출력: 마스크 min/max 정규화 후 원본 크기로 복원. 일정한 마스크에서는 0으로 나누지 않고 예측값을 범위 안으로 제한합니다.
- Web Worker에서 WebGPU를 우선 사용합니다. 초기화나 실행 실패 시 WASM 단일 스레드로 대체합니다. `?engine=wasm`으로 강제 검증할 수 있습니다.
- 작업 취소 시 Worker를 종료합니다. 다음 작업은 모델 캐시를 재사용하되 추론 세션을 다시 만듭니다.

모델을 재구성하려면 다음을 실행합니다. `curl`이 필요하고 빌드 준비 시에만 Hugging Face에 접속합니다.

```sh
npm run prepare:model
```

8MiB 조각 21개와 전체·조각별 체크섬을 생성합니다. 기존 `model-lock.json`과 일치하지 않는 파일은 거부합니다. 런타임 모듈도 고정된 npm 패키지에서 복사합니다.

모델을 교체할 때는 준비 스크립트의 리비전, 검토한 `model-lock.json`, 전처리 설정, 라이선스와 `_headers`의 리비전 경로를 함께 변경하고 검증을 반복합니다. 새 리비전은 별도 Cache Storage를 쓰고 이전 모델 캐시를 제거합니다. 체크섬이 맞지 않는 캐시 조각은 다시 내려받습니다. 브라우저 사이트 데이터 삭제로 캐시를 수동 초기화할 수 있습니다.

## 개인정보와 정적 호스팅

원본·미리보기·결과는 메모리에만 유지합니다. 파일명은 화면에만 표시합니다. Cache Storage에는 모델 조각만 저장하며 사용자 이미지는 저장하지 않습니다. 페이지를 닫으면 현재 작업은 사라집니다. 분석·오류 전송 SDK나 외부 폰트가 없습니다.

모델과 런타임은 동일 사이트에서 제공합니다. GitHub Pages에서는 `_headers` 파일이 적용되지 않으므로 빌드 HTML의 CSP 및 referrer 메타 태그를 사용합니다. 헤더로만 가능한 frame-ancestors와 nosniff, 사용자 지정 HTTP 캐시 정책은 Pages에서 설정하지 못합니다. 모델의 Cache Storage 재사용은 계속 동작합니다. 캐시가 차단되거나 저장 공간이 부족해도 해당 세션에서 처리가 가능합니다.

## 주소와 소스 구조

| 경로 | 역할 | 구현 상태 |
|---|---|---|
| `https://platformndev.github.io/` | 도구 목록 | 구현됨 |
| `https://platformndev.github.io/remove-bg/` | 이미지 배경 제거 | 구현됨 |
| `https://platformndev.github.io/generator-password/` | 향후 비밀번호 생성 도구 | 아직 미구현 |

소스와 배포 설정을 이 저장소 하나에서 관리합니다. 이전 `InternalToolGui` 저장소는 새 배포에 사용하지 않습니다.

```text
site/                       # 조직 사이트의 도구 목록과 정적 파일
  index.html
  portal.css
src/                        # 현재 배경 제거 앱 소스
index.html                  # 배경 제거 앱의 HTML 진입점
public/                     # 배경 제거 모델·실행 파일·사진
scripts/build-site.mjs       # 전체 사이트 빌드
.github/workflows/pages.yml # GitHub Pages 자동·수동 배포
```

`npm run build:site`는 생성물인 `dist/`를 비운 뒤 다음 구조로 재구성합니다. `dist/`를 직접 편집하지 마세요.

```text
dist/
├── .nojekyll
├── index.html              # /
├── portal.css
└── remove-bg/
    ├── index.html          # /remove-bg/
    ├── assets/
    ├── models/
    ├── ort/
    ├── examples/
    └── licenses.txt
```

배경 제거 앱은 `/remove-bg/` 기준으로 빌드하므로 사진·모델·WASM·Worker·라이선스 링크가 모두 이 경로를 사용합니다. `/remove-bg`로 들어오면 GitHub Pages가 `/remove-bg/`로 이동시킵니다. 기존 `npm run build`와 `npm run preview`는 배경 제거 앱 단독 빌드·미리보기용이며, 조직 사이트를 게시할 때는 반드시 `build:site`를 사용합니다.

## GitHub Pages 호스팅 방법

### 먼저 필요한 GitHub 설정

저장소는 **https://github.com/PlatformnDev/platformndev.github.io** 이며, 로컬 `origin`도 이 주소를 사용합니다. 조직 사이트의 기본 주소는 **https://platformndev.github.io/** 입니다. Pages 게시 방식은 **GitHub Actions**로 설정되어 있습니다.

현재 CLI 계정 `youngjinmo`에는 쓰기 권한이 있습니다. `main` 보호 규칙 때문에 직접 푸시할 수 없고, 변경은 PR과 승인 1건을 거쳐 병합해야 합니다. 저장소 이름·Pages 설정 변경은 관리자 권한이 필요합니다.

로컬 원격 주소를 확인하거나 예전 체크아웃을 갱신하려면:

```sh
git remote set-url origin https://github.com/PlatformnDev/platformndev.github.io.git
git remote -v
```

### 소스 올리기와 배포

작업 브랜치에서 변경을 커밋하고 푸시한 뒤 PR을 만듭니다. 승인 후 `main`에 병합하며 보호 규칙을 우회하거나 강제 푸시하지 않습니다.

```sh
npm ci
npm test
npm run build:site
git push -u origin HEAD
```

이 워크플로 변경이 승인·병합된 뒤에는 `main` 업데이트 시 자동 배포합니다. 변경할 코드 없이 다시 배포하려면 GitHub에서 **Actions → Deploy organization tools → Run workflow → main**을 선택합니다.

워크플로는 테스트 → 전체 사이트 빌드 → 정적 파일 저장 → GitHub Pages 배포 순서로 실행됩니다. 저장소가 `PlatformnDev/platformndev.github.io`가 아니면 빌드까지만 수행하고 배포 작업은 건너뜁니다. 잘못된 주소에 게시하지 않기 위한 조건입니다. 저장소 기본 토큰을 사용하므로 소스 코드에 인증 토큰을 추가하지 않습니다. `github-pages` 환경에 승인 규칙이 있다면 지정된 검토자가 승인해야 합니다.

- 워크플로 성공 후 https://platformndev.github.io/ 에서 도구 목록을 확인합니다.
- 배경 제거 카드로 이동하거나 https://platformndev.github.io/remove-bg/ 에 직접 접속합니다.
- 로그인하지 않은 브라우저에서 예시 및 직접 선택한 이미지의 처리·PNG 다운로드를 확인합니다. 첫 실행에는 약 199MB의 모델·실행 자산을 내려받아 시간이 걸릴 수 있습니다.

**올바른 저장소 이름에서는 `main` 푸시 시 자동 배포합니다.** 수동 실행도 지원합니다. 기존 ChatGPT Sites는 공개 접근 차단 상태이며 다시 배포하지 않습니다.

### 새로운 도구 추가

1. 새 경로를 소문자·하이픈 형태로 정합니다. 예: `/generator-password/`.
2. 빌드가 필요 없는 도구는 `site/generator-password/`에 넣습니다. 전체 사이트 빌드가 이 폴더를 `dist/generator-password/`로 복사합니다.
3. 별도 빌드가 필요한 도구는 소스를 `tools/generator-password/` 등에 두고 `scripts/build-site.mjs`에 해당 빌드 단계를 추가합니다. 출력은 `dist/generator-password/`, 자산 기본 경로는 `/generator-password/`로 지정합니다. 배경 제거에 필요한 `src/`는 기존 위치에 둡니다.
4. `site/index.html`에 새 도구 링크를 추가합니다. 구현되지 않은 도구를 사용 가능한 링크로 표시하지 않습니다.
5. `npm run build:site`와 `npm run preview:site`로 모든 도구를 검증한 다음 전체 사이트를 한 번에 게시합니다.

각 도구의 부분 결과물을 따로 `deploy-pages`에 올리면 이전 도구가 사라질 수 있으므로 **도구 목록과 모든 도구를 포함한 `dist/` 하나를 게시**합니다. `site/remove-bg/`는 빌드 출력과 충돌하므로 사용하지 않습니다. 도구별 데이터 캐시 이름도 서로 구분하세요.

### 운영 참고

호스팅은 정적 파일 전송만 담당하며 사용자 이미지와 결과는 브라우저에서 처리합니다. 추론 서버나 유료 이미지 처리 API는 없습니다. GitHub Pages의 사이트 용량·트래픽 제한은 모든 도구가 함께 사용합니다. 모델 Cache Storage는 재사용하지만 완전한 오프라인 PWA는 아닙니다.

`.openai/hosting.json`은 이전 Sites 식별 정보이며 GitHub 배포에는 사용하지 않습니다. 이전 `InternalToolGui` 저장소의 Pages 설정도 이 저장소와 별개입니다.

공식 문서: [Pages 사이트 유형과 주소](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Actions로 Pages 배포](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## 검증

[검증 기록](docs/VALIDATION.md)에 실제 실행 결과와 한계를 기록했습니다.

`tests/core.test.mjs`는 Node 기본 테스트 러너를 사용합니다. 브라우저 검증 스크립트는 외부 QA 런타임의 Playwright와 Sharp를 사용하며 제품 의존성에 포함하지 않습니다. 환경 변수 `PLAYWRIGHT_PATH`, `SHARP_PATH`에 해당 모듈 경로를 지정할 수 있습니다.

```sh
node scripts/prepare-samples.mjs
node tests/fixtures.cjs
# 다른 터미널에서 npm run preview 실행
node tests/browser.cjs
# 추가 검증은 npm run dev와 npm run preview 둘 다 필요
node tests/edgecases.cjs
node tests/additional.cjs
```

샘플은 공개 테스트 자료이며 `.cache/samples/`에만 내려받습니다. `test-results/`의 원본·결과·스크린샷·네트워크 기록은 배포하거나 커밋하지 않습니다.

## 라이선스

[오픈소스 고지](public/licenses.txt)를 참고하세요. 모델 게시자의 MIT 표시와 원본 IS-Net 프로젝트의 Apache-2.0 고지를 함께 기록했습니다. AGPL인 `@imgly/background-removal` 패키지 코드는 사용하지 않습니다.

## 사용 예시 사진

예시 버튼은 오타니 쇼헤이의 2024년 경기 사진을 사용합니다. 촬영자 David, CC BY 2.0. 원본 출처·기존 크롭 작업자·축소 및 배경 제거 변경 사항은 `public/examples/ATTRIBUTION.md`와 화면에 표시합니다. 사진은 사이트 정적 자산에서 불러오며 외부 사진 서버에 접속하지 않습니다.
