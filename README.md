# Clearcut

브라우저에서 이미지 배경을 제거하는 정적 사이트입니다. 이미지를 서버에 보내지 않습니다. Vite + TypeScript + ONNX Runtime Web으로 구성했으며 로그인, API 서버, 데이터베이스가 없습니다.

## 로컬에서 실행하기

Node.js 22.23 이상과 Git을 설치합니다. Node 설치에 포함된 npm을 사용합니다.

```sh
git clone https://github.com/PlatformnDev/InternalToolGui.git
cd InternalToolGui
npm ci
npm run dev
```

터미널에 표시되는 주소(기본 `http://127.0.0.1:5173/`)를 브라우저에서 엽니다. 이미지를 선택하거나 오타니 예시 버튼을 누르면 자동으로 배경을 제거합니다. 완료 후 **투명 PNG 다운로드**로 저장합니다. 종료하려면 터미널에서 `Ctrl+C`를 누릅니다.

이미 이 작업 폴더에 있다면 `git clone`과 `cd`를 생략하고 `npm ci`부터 실행합니다. 포트가 사용 중이면 터미널에 표시된 다른 포트를 사용하세요. Chrome·Edge 계열 데스크톱 브라우저를 권장하며 실제 검증 범위는 아래 검증 기록을 참고하세요.

모델 조각과 실행 파일은 `public/`에 포함되어 있어 정상 체크아웃 후 별도 모델 다운로드 없이 실행할 수 있습니다. 브라우저가 처음 실행할 때 로컬 서버에서 모델 약 176MB와 실행 자산 약 22MB를 읽습니다. 이미지 처리는 브라우저 안에서 수행합니다. 파일이 누락되었다면 `npm run prepare:model`로 복구할 수 있으며, 이 준비 명령은 인터넷에 접속합니다.

배포용 빌드를 로컬에서 확인하려면:

```sh
npm run build
npm run preview
```

기본 주소는 `http://127.0.0.1:4173/`이며 종료는 `Ctrl+C`입니다. 테스트는 `npm test`로 실행합니다. `dist/`가 완전 정적 결과물입니다. `index.html`을 파일 탐색기에서 직접 열면 Worker·모델 로딩이 동작하지 않으므로 반드시 로컬 서버 또는 HTTPS 호스팅을 사용하세요.

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

## GitHub Pages 호스팅 방법

### 현재 상태와 필요한 주소

- 소스 저장소: https://github.com/PlatformnDev/InternalToolGui
- 목표 주소: https://platformndev.github.io/remove-bg/ (`/remove-bg`로 접속하면 디렉터리 주소로 이동)
- 기존 ChatGPT Sites는 공개 접근을 차단해 소유자만 접근할 수 있습니다. 배포 기록과 프로젝트 자체는 삭제하지 않았습니다.
- 자동 배포는 중단했습니다. `.github/workflows/pages.yml`은 수동 실행 시 정적 파일 묶음만 생성하며 사이트를 게시하지 않습니다.

**저장소 이름과 기본 Pages 주소는 연결됩니다.** `InternalToolGui` 저장소에 직접 Pages를 켜면 `https://platformndev.github.io/InternalToolGui/`가 됩니다. Vite의 `base`만 `/remove-bg/`로 바꿔도 Pages 주소가 바뀌지는 않습니다.

### 도구 모음의 주소와 저장소 구조

기본 주소는 **https://platformndev.github.io/** 입니다. 하나의 조직 사이트 아래에 도구별 폴더를 추가합니다.

| 주소 | 역할 | 상태 |
|---|---|---|
| `/` | 도구 목록과 각 도구로 이동하는 시작 화면 | 추후 구성 |
| `/remove-bg/` | 이미지 배경 제거 | 구현됨, 게시 중단 상태 |
| `/generator-password/` | 비밀번호 생성 도구 | 향후 추가 예시, 미구현 |

역할은 다음처럼 나눕니다.

- **`PlatformnDev/InternalToolGui`**: 도구 소스와 빌드 설정을 관리합니다. 현재 배경 제거 소스는 이 저장소 루트에 있습니다. 도구가 추가되면 소스를 `tools/remove-bg/`, `tools/generator-password/` 등으로 분리할 수 있습니다.
- **`PlatformnDev/PlatformnDev.github.io`**: 도구 모음의 정적 결과물을 게시하는 조직 사이트 저장소입니다. 이 저장소의 이름이 기본 주소 `platformndev.github.io`를 결정합니다.

게시 저장소의 최종 구조는 다음과 같습니다. 비밀번호 생성 도구와 시작 화면은 구조 예시이며 현재 빌드에 포함되어 있지 않습니다.

```text
PlatformnDev.github.io/
├── .nojekyll
├── index.html                 # 도구 목록: /
├── remove-bg/
│   ├── index.html             # /remove-bg/
│   ├── assets/
│   ├── models/
│   ├── ort/
│   └── examples/
└── generator-password/
    ├── index.html             # /generator-password/
    └── assets/
```

도구마다 별도의 GitHub Pages 사이트나 커스텀 도메인을 만들 필요는 없습니다. **조직 사이트 하나를 게시하고, 하위 폴더로 도구를 구분합니다.** 폴더 이름은 소문자와 하이픈으로 통일합니다. `/remove-bg`로 들어오면 GitHub Pages가 `/remove-bg/`로 이동시킵니다.

확인 시점에 `InternalToolGui`의 Pages는 `production` 브랜치의 루트를 게시하도록 설정되어 있었습니다. 현재 계정에는 이 저장소의 쓰기 권한은 있으나 관리자 권한은 없으며, 조직 사이트 저장소는 조회되지 않았습니다(미생성 또는 접근 권한 없음). 조직 관리자에게 조직 사이트 저장소 생성·접근 권한과 아래 Pages 설정을 요청하세요.

### 1. 게시할 정적 파일 만들기

로컬 소스 저장소에서 실행합니다(macOS/Linux 셸 기준).

```sh
npm ci
npm test
npm run build -- --base=/remove-bg/
```

이 명령은 모델·WASM·이미지·Worker를 포함한 `dist/`를 생성합니다. 파일 크기는 약 199MB입니다. 런타임에는 외부 모델 CDN을 사용하지 않습니다.

로컬에서 같은 주소 구조로 검사하려면:

```sh
npm run preview -- --base=/remove-bg/
```

`http://127.0.0.1:4173/remove-bg/`에서 파일 선택 → 배경 제거 → PNG 다운로드를 확인하고 `Ctrl+C`로 종료합니다.

로컬 빌드 대신 GitHub에서 **InternalToolGui → Actions → Prepare GitHub Pages files → Run workflow**를 실행해도 됩니다. 성공한 실행에서 `remove-bg-pages` 아티팩트를 내려받아 압축을 풀면 `.nojekyll`과 `remove-bg/` 폴더가 있습니다. 이 단계는 파일만 만들며 공개 배포는 하지 않습니다.

### 2. 조직 사이트 저장소에 결과 넣기

조직 관리자에게 `PlatformnDev/PlatformnDev.github.io` 저장소를 준비하도록 요청합니다. 이미 조직 사이트가 있다면 그 저장소의 기존 배포 방식과 파일을 보존해야 합니다. 아래 예시는 새 저장소이거나 `main` 브랜치 루트를 정적으로 게시하는 조직 사이트 기준입니다. 기존 사이트가 GitHub Actions로 게시된다면 그 사이트의 빌드 결과에 `remove-bg/`를 병합해야 하며, 기존 Pages 설정을 덮어쓰면 안 됩니다.

로컬 소스 폴더 `InternalToolGui`와 조직 사이트 폴더가 같은 상위 폴더에 있도록 체크아웃합니다.

```sh
# InternalToolGui 폴더에서 실행
cd ..
git clone https://github.com/PlatformnDev/PlatformnDev.github.io.git
cd PlatformnDev.github.io
# 이미 체크아웃한 저장소라면 clone 대신 해당 폴더에서 기존 변경 사항을 확인한 뒤 git pull
mkdir -p remove-bg
cp -R ../InternalToolGui/dist/. remove-bg/
touch .nojekyll
git add remove-bg .nojekyll
git commit -m "Deploy background removal tool"
git push origin main
```

새 빈 저장소이고 현재 브랜치가 `main`이 아니면 최초 푸시 전에 `git branch -M main`을 실행합니다. 아티팩트를 받은 경우 `cp` 대신 압축 해제한 `remove-bg/`와 `.nojekyll`을 사이트 저장소 루트로 복사합니다. **조직 사이트 루트의 다른 파일은 삭제하지 않습니다.** 이후 재배포 시 불필요한 이전 빌드 파일은 이 도구 전용 `remove-bg/` 안에서만 정리합니다. 원본 소스나 `node_modules`는 게시하지 않습니다.

### 3. 조직 사이트의 Pages 켜기

조직 사이트 저장소의 관리자가 다음을 설정합니다.

1. **PlatformnDev.github.io → Settings → Pages**로 이동합니다.
2. **Build and deployment → Source: Deploy from a branch**를 선택합니다.
3. **Branch: main**, 폴더 **/(root)**를 선택하고 저장합니다.
4. Pages 배포 작업이 성공하면 https://platformndev.github.io/remove-bg/ 에 접속합니다.
5. 로그인하지 않은 브라우저에서 예시 및 직접 선택한 이미지의 배경 제거·PNG 다운로드를 확인합니다. 첫 실행에는 모델 다운로드 시간이 필요합니다.

이 절차를 적용하기 전에는 목표 주소가 동작한다고 보장할 수 없습니다. 이 문서 작성 시 목표 주소로 배포하지 않았으며, 기존 GitHub Pages 설정도 변경하지 않았습니다.

### 새 도구를 추가하거나 기존 도구를 갱신할 때

1. 도구별 고유 경로를 정합니다. 예를 들어 비밀번호 생성 도구는 `/generator-password/`입니다.
2. 해당 도구를 그 경로 기준으로 빌드합니다. Vite라면 `--base=/generator-password/`를 사용합니다. JavaScript에서 직접 불러오는 파일도 이 기본 경로를 따라야 합니다.
3. 결과물을 조직 사이트 저장소의 `generator-password/`에 넣고 루트 `index.html`의 도구 목록에 링크를 추가합니다.
4. 조직 사이트를 게시하면 기존 `/remove-bg/`와 새 도구를 함께 사용할 수 있습니다.

도구 하나를 갱신할 때는 **그 도구 폴더만 교체**하고 다른 도구와 루트 시작 화면을 보존합니다. 현재 수동 빌드가 만드는 `remove-bg-pages`는 배경 제거 도구만 들어 있는 부분 결과물입니다. 기존 조직 사이트 파일에 합쳐야 하며, 이를 조직 사이트 전체로 간주해 덮어쓰면 다른 도구가 사라집니다.

나중에 GitHub Actions로 게시를 자동화할 때도 **모든 도구와 시작 화면을 모은 최종 결과물 하나**를 `deploy-pages`에 전달해야 합니다. 도구별 작업이 서로 다른 부분 결과물을 같은 조직 사이트에 각각 배포하도록 구성하지 않습니다. 현재 워크플로는 수동 파일 생성만 수행합니다.

### 운영 참고

모델 캐시는 같은 브라우저에서 재사용합니다. 정적 자산 트래픽은 발생하지만 추론 서버나 유료 이미지 처리 API는 없습니다. GitHub Pages의 용량·트래픽 제한을 확인하고 운영하세요. 완전한 오프라인 PWA는 아닙니다.

`.openai/hosting.json`은 이전 Sites 식별 정보이며 GitHub 배포에는 사용하지 않습니다. 이후 Sites에 다시 배포하지 않습니다. GitHub의 `production` 브랜치 Pages와 수동 파일 생성 워크플로는 별개입니다. 기존 GitHub 사이트까지 중단하려면 저장소 관리자가 Settings → Pages에서 **Unpublish site**를 실행해야 합니다.

공식 문서: [Pages 사이트 유형과 주소](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [게시 브랜치 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

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
