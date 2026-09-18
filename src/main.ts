import './style.css';
import {removeBackground,type Update,type Result} from './processor';
import {outputFilename} from './core';
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=$<HTMLInputElement>('file'),dropzone=$('dropzone'),editor=$('editor'),status=$('status'),actions=$('actions');
let controller:AbortController|undefined,pending:Promise<void>|undefined,selected:File|undefined,result:Result|undefined;
let generation=0,previewURL:string|undefined,resultURL:string|undefined,state='idle';
const clearUrls=()=>{if(previewURL)URL.revokeObjectURL(previewURL);if(resultURL)URL.revokeObjectURL(resultURL);previewURL=resultURL=undefined;};
const button=(text:string,fn:()=>void,secondary=false)=>{const b=document.createElement('button');b.textContent=text;if(secondary)b.className='secondary';b.onclick=fn;actions.append(b);return b;};
function cancel(){generation++;controller?.abort();controller=undefined;state='cancelled';status.className='';status.textContent='작업을 취소했습니다. 다시 시도하거나 다른 이미지를 선택해 주세요.';actions.replaceChildren();if(selected)button('다시 시도',()=>void start(selected!));button('다른 이미지 선택',()=>input.click(),true);const waiting=editor.querySelector('.waiting');if(waiting)waiting.textContent='작업이 취소되었습니다.';}
function renderPreview(update:Update){
 clearUrls();previewURL=URL.createObjectURL(update.preview!);editor.replaceChildren();editor.hidden=false;dropzone.hidden=true;
 const top=document.createElement('div');top.className='editor-top';const name=document.createElement('span');name.className='filename';name.textContent=selected!.name;const meta=document.createElement('span');meta.className='meta';meta.textContent=`${update.width?.toLocaleString()} × ${update.height?.toLocaleString()} px · ${(selected!.size/1024/1024).toFixed(1)}MB`;top.append(name,meta);editor.append(top);
 const panes=document.createElement('div');panes.className='previews';
 for(const [label,isResult] of [['원본',false],['배경 제거',true]] as const){const pane=document.createElement('section');const title=document.createElement('div');title.className='pane-label';const strong=document.createElement('strong');strong.textContent=label;title.append(strong);const box=document.createElement('div');box.className='preview'+(isResult?' checker':'');if(isResult){box.id='result';const waiting=document.createElement('div');waiting.className='waiting';waiting.innerHTML='<span class="spinner" aria-hidden="true"></span>이미지를 준비하고 있어요';box.append(waiting);}else{const img=document.createElement('img');img.src=previewURL;img.alt='선택한 원본 이미지';box.append(img);}pane.append(title,box);panes.append(pane);}
 editor.append(panes);if(['gif','webp','png','avif'].includes(update.format!)){const notice=document.createElement('p');notice.className='notice';notice.textContent='움직이는 이미지인 경우 첫 프레임만 처리합니다.';editor.append(notice);}
}
function updateUI(update:Update){
 if(update.preview)renderPreview(update);state=update.stage;status.className='';status.replaceChildren();
 if(update.stage==='validating')status.textContent='파일 확인 중…';
 if(update.stage==='loading'){
 status.textContent='모델 준비 중… 처음 사용할 때 약 176MB의 모델을 내려받아 시간이 걸릴 수 있어요.';
 if(update.total!==undefined){const p=document.createElement('progress');p.max=update.total;p.value=update.done??0;p.setAttribute('aria-label','처리 도구 준비');status.append(p);const s=document.createElement('span');s.textContent=` ${Math.round((update.done??0)/update.total*100)}%`;status.append(s);}
 }
 if(update.stage==='processing'){status.textContent='배경 제거 중… 브라우저와 이미지에 따라 시간이 걸릴 수 있어요.';const w=editor.querySelector('.waiting');if(w)w.innerHTML='<span class="spinner" aria-hidden="true"></span>배경을 제거하고 있어요';}
}
async function start(file:File){
 const token=++generation;controller?.abort();await pending?.catch(()=>{});if(token!==generation)return;
 clearUrls();editor.replaceChildren();editor.hidden=true;dropzone.hidden=false;selected=file;result=undefined;controller=new AbortController();const signal=controller.signal;actions.replaceChildren();button('취소',cancel,true);button('다른 이미지 선택',()=>input.click(),true);
 pending=(async()=>{try{
 const output=await removeBackground(file,signal,u=>{if(token===generation)updateUI(u);});if(token!==generation)return;
 result=output;state='complete';resultURL=URL.createObjectURL(output.blob);const image=document.createElement('img');image.src=resultURL;image.alt='배경이 투명하게 제거된 이미지';$('result').replaceChildren(image);
 status.className='';status.textContent='완료! 원본 크기의 투명 PNG로 저장할 수 있어요.';actions.replaceChildren();button('다른 이미지 선택',()=>input.click(),true);
 const download=document.createElement('a');download.className='button';download.href=resultURL;download.download=outputFilename(file.name);download.textContent='투명 PNG 다운로드';actions.append(download);download.focus();
 }catch(e){if(token!==generation||signal.aborted)return;state='error';status.className='error';status.textContent=e instanceof Error?e.message:'처리에 실패했습니다. 다시 시도해 주세요.';const w=editor.querySelector('.waiting');if(w)w.textContent='처리를 완료하지 못했어요';actions.replaceChildren();button('다시 시도',()=>void start(file));button('다른 이미지 선택',()=>input.click(),true);
 }finally{if(token===generation)controller=undefined;}})();await pending;
}
function choose(files:FileList|null){if(!files?.length)return;if(files.length!==1){status.className='error';status.textContent='이미지는 한 번에 한 장씩 선택해 주세요.';return;}void start(files[0]);}
input.addEventListener('change',()=>{choose(input.files);input.value='';});
for(const event of ['dragenter','dragover'])document.addEventListener(event,e=>{e.preventDefault();dropzone.classList.add('dragging');});
document.addEventListener('dragleave',e=>{if(!(e as DragEvent).relatedTarget)dropzone.classList.remove('dragging');});
document.addEventListener('drop',e=>{e.preventDefault();dropzone.classList.remove('dragging');choose(e.dataTransfer?.files??null);});
window.addEventListener('pagehide',()=>{controller?.abort();clearUrls();});
// Optional browser-native agent interface. Never exposes image bytes or filenames.
const context=(document as unknown as {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
if(context?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 for(const tool of [{name:'get_background_removal_status',title:'배경 제거 상태 확인',description:'현재 작업 단계와 결과 준비 여부를 확인합니다.',annotations:{readOnlyHint:true},execute:()=>({state,ready:!!result})},{name:'cancel_background_removal',title:'배경 제거 취소',description:'진행 중인 배경 제거 작업을 취소합니다.',annotations:{readOnlyHint:false},execute:()=>{if(!controller)throw Error('진행 중인 작업이 없습니다.');cancel();return{state};}}])try{Promise.resolve(context.registerTool({...tool,inputSchema:{type:'object',properties:{},additionalProperties:false},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('빈 객체만 허용합니다.');return tool.execute();}},{signal:lifecycle.signal})).catch(()=>{});}catch{}
}
