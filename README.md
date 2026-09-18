# Platformn 도구 모음

브라우저에서 동작하는 정적 도구 사이트입니다. 이미지 배경 제거 기능을 두 가지 모델로 제공하며, 이미지 처리는 서버로 전송하지 않고 브라우저에서 수행합니다.

## 기술 스택

- TypeScript
- Vite
- ONNX Runtime Web
- ONNX 이미지 배경 제거 모델과 경량 INT8 모델
- Web Worker, WebGPU 및 WebAssembly(WASM)
- 정적 호스팅: GitHub Pages

## 정적 웹 배포 방법

GitHub Pages와 GitHub Actions를 사용합니다. 저장소의 `main` 브랜치에 변경사항이 반영되거나 Actions에서 수동 실행하면 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)이 다음 순서로 전체 정적 사이트를 배포합니다.

1. 의존성을 설치합니다.
2. 테스트를 실행합니다.
3. `npm run build:site`로 전체 사이트를 `dist/`에 생성합니다.
4. `dist/`를 GitHub Pages에 게시합니다.

로컬에서 배포 결과를 확인하려면 다음을 실행합니다.

```sh
npm ci
npm test
npm run build:site
npm run preview:site
```

`dist/`는 다른 정적 호스팅 서비스에도 업로드할 수 있는 배포 결과물입니다. GitHub Pages에서 사용할 때는 저장소 설정의 Pages 배포 방식을 `GitHub Actions`로 지정합니다.

## 로컬 실행

Node.js 22 이상과 npm이 필요합니다.

```sh
npm ci
npm run dev
```

터미널에 표시된 주소(기본값: `http://127.0.0.1:5173/`)를 브라우저에서 엽니다. 전체 사이트를 확인하려면 `npm run build:site && npm run preview:site`를 실행하고, `http://127.0.0.1:4173/`에서 도구 목록을 확인합니다. 기본 모델 앱은 `/remove-bg/`, 경량 모델 앱은 `/remove-bg-light/` 경로에서 실행됩니다.

`/remove-bg/`는 첫 사용 시 모델과 실행 리소스로 최대 약 200MB, `/remove-bg-light/`는 최대 약 65MB를 내려받을 수 있습니다. 두 모델은 별도 캐시에 저장되므로 비교해서 사용할 수 있습니다.
