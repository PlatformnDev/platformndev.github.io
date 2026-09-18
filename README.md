# Clearcut

브라우저에서 이미지 배경을 제거하는 정적 사이트입니다. 이미지를 서버에 보내지 않습니다. Vite + TypeScript + ONNX Runtime Web으로 구성했으며 로그인, API 서버, 데이터베이스가 없습니다.

## 실행과 빌드

Node.js 22.23 이상을 사용합니다.

```sh
npm ci
npm run dev
```

모델 조각과 실행 파일은 `public/`에 포함되어 있어 체크아웃 후 별도 다운로드 없이 실행할 수 있습니다. `.cache`의 원본 모델은 버전 관리에서 제외합니다.

```sh
npm run build
npm run preview
npm test
```

`dist/`가 배포 가능한 완전 정적 결과물입니다. 실행에는 HTTPS 또는 localhost가 필요합니다. 사이트를 파일로 직접 열면 Worker·WebGPU·모델 로딩이 동작하지 않습니다.

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

## GitHub Pages 배포

`.github/workflows/pages.yml`이 `main` 푸시 시 테스트 → 정적 빌드 → GitHub Pages 배포를 수행합니다. 저장소 Settings → Pages의 Source를 GitHub Actions로 지정합니다. 인증 토큰은 소스에 넣지 않으며 Actions의 일회성 기본 토큰을 사용합니다.

배포 경로는 Pages 설정에서 가져옵니다. 로컬에서 프로젝트 경로를 검증하려면 다음과 같이 실행합니다.

```sh
SITE_BASE_PATH=/remove-bg/ npm run build
SITE_BASE_PATH=/remove-bg/ npm run preview
```

사진·모델·WASM·Worker·라이선스 링크는 모두 해당 경로를 따릅니다. 모델과 실행 자산 약 199MB는 정적 결과물에 포함됩니다. `.openai/hosting.json`은 이전 Sites 식별 정보이며 GitHub 배포에는 사용하지 않습니다. 이후 Sites에 다시 배포하지 않습니다.

호스팅에는 정적 자산 트래픽이 발생합니다. 추론 서버 비용이나 유료 이미지 처리 API 호출은 없습니다. 완전한 오프라인 PWA를 제공하는 것은 아닙니다.

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
