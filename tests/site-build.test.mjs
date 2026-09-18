import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url);
const path=(p)=>new URL(p,root);
const dist=(p)=>path(`dist/${p}`);

function buildSite(){
  execFileSync('npm',['run','build:site'],{cwd:path('.').pathname,stdio:'pipe'});
}

function readManifest(route){
  return JSON.parse(readFileSync(dist(`${route}/models/manifest.json`),'utf8'));
}

function sha256(bytes){
  return createHash('sha256').update(bytes).digest('hex');
}

test('Given 사이트 빌드가 실행되면 When 표준과 Light 경로를 확인하면 Then 두 배포본이 함께 생성된다',()=>{
  buildSite();
  for(const route of ['remove-bg','remove-bg-light']){
    assert.equal(existsSync(dist(`${route}/index.html`)),true,`${route} index.html`);
    assert.equal(existsSync(dist(`${route}/models/manifest.json`)),true,`${route} model manifest`);
    assert.equal(existsSync(dist(`${route}/ort/ort.webgpu.min.mjs`)),true,`${route} ORT runtime`);
  }
});

test('Given 두 배포본이 빌드되면 When 매니페스트를 읽으면 Then 표준 모델과 Light 모델은 서로 다른 모델을 가리킨다',()=>{
  const standard=readManifest('remove-bg');
  const light=readManifest('remove-bg-light');
  assert.notEqual(standard.revision,light.revision);
  assert.notEqual(standard.sha256,light.sha256);
  assert.ok(standard.bytes>100_000_000);
  assert.ok(light.bytes<standard.bytes);
  assert.ok(light.bytes<100_000_000);
});

test('Given 각 모델 매니페스트가 있으면 When 청크를 검증하면 Then 모든 청크의 크기와 해시가 매니페스트와 일치한다',()=>{
  for(const route of ['remove-bg','remove-bg-light']){
    const manifest=readManifest(route);
    let total=0;
    for(const chunk of manifest.chunks){
      const bytes=readFileSync(dist(`${route}/models/${manifest.revision}/${chunk.file}`));
      assert.equal(bytes.byteLength,chunk.bytes,`${route}/${chunk.file} size`);
      assert.equal(sha256(bytes),chunk.sha256,`${route}/${chunk.file} sha256`);
      total+=bytes.byteLength;
    }
    assert.equal(total,manifest.bytes,`${route} model size`);
  }
});

test('Given 표준 경로가 배포되면 When HTML을 읽으면 Then 기존 이미지 배경 제거 이름과 다운로드 주의 메시지가 유지된다',()=>{
  const html=readFileSync(dist('remove-bg/index.html'),'utf8');
  assert.match(html,/이미지 배경 제거/);
  const assets=readdirSync(dist('remove-bg/assets')).filter(name=>name.endsWith('.js')).map(name=>readFileSync(dist(`remove-bg/assets/${name}`),'utf8')).join('\n');
  assert.match(assets,/176MB|모델 준비|리소스|다운로드/);
});

test('Given Light 경로가 배포되면 When HTML을 읽으면 Then 이미지 배경 제거 (Light) 이름과 Light 경로가 표시된다',()=>{
  const html=readFileSync(dist('remove-bg-light/index.html'),'utf8');
  assert.match(html,/이미지 배경 제거 \(Light\)/);
  assert.match(html,/remove-bg-light/);
});
