// Use the bundled validation runtime or install Playwright separately for QA.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const sharp=require(process.env.SHARP_PATH||'sharp');
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const base=process.env.SITE_URL||'http://127.0.0.1:4173';const root=process.cwd();const samples=path.join(root,'.cache/samples');const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});const page=await context.newPage();const requests=[],errors=[];
 page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?engine=wasm');const cdp=await context.newCDPSession(page);
 const report={browser:browser.version(),base,engine:'wasm',results:[],memory:[],errors,requests:[]};
 async function run(file,label=file){
 const started=Date.now();await page.locator('#file').setInputFiles(path.join(samples,file));
 await page.waitForFunction(name=>document.querySelector('.filename')?.textContent===name&&(document.querySelector('#status').textContent.startsWith('완료')||document.querySelector('#status').classList.contains('error')),file,{timeout:180000});
 const status=await page.locator('#status').innerText();assert.ok(status.startsWith('완료'),status);
 const elapsed=Date.now()-started;const downloadEvent=page.waitForEvent('download');await page.locator('a[download]').click();const d=await downloadEvent;assert.equal(d.suggestedFilename(),file.replace(/\.[^.]+$/,'')+'-no-bg.png');const output=path.join(out,label+'.png');await d.saveAs(output);
 const {data,info}=await sharp(output).ensureAlpha().raw().toBuffer({resolveWithObject:true});let min=255,max=0,transparent=0;for(let i=3;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);if(data[i]<10)transparent++;}
 const r={file,elapsed,width:info.width,height:info.height,alphaMin:min,alphaMax:max,transparentPercent:Math.round(transparent/(info.width*info.height)*100)};report.results.push(r);console.log(JSON.stringify(r));return{data,info};
 }
 for(const file of ['format.png','format.jpeg','format.webp','format.avif','format.bmp','format.gif']){const r=await run(file);assert.equal(r.info.width,320);assert.equal(r.info.height,320);assert.ok(r.data.some((v,i)=>i%4===3&&v<5));}
 const t=await run('transparent.png');for(let y=0;y<t.info.height;y++)for(let x=0;x<t.info.width;x++)assert.ok(t.data[(y*t.info.width+x)*4+3]<=(x<32?0:128));
 await run('orientation.jpeg');
 // Invalid inputs must not poison the next job.
 for(const payload of [{name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')},{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')},{name:'large.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(20*1024*1024+1)}]){await page.locator('#file').setInputFiles(payload);await page.waitForFunction(()=>document.querySelector('#status').classList.contains('error'));assert.equal(await page.locator('a[download]').count(),0);}
 await run('astronaut.png','recovery');
 // Cancel and immediately replace while model inference is underway.
 await page.locator('#file').setInputFiles(path.join(samples,'astronaut.png'));await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('배경 제거 중'));await page.getByRole('button',{name:'취소',exact:true}).click();await run('chelsea.png','after-cancel');
 const names=['astronaut.png','camera.png','chelsea.png','coffee.png','coins.png','motorcycle_left.png','rocket.jpg','dog.jpg','grace_hopper.jpg','horse.png'];
 for(const file of names){await run(file,'quality-'+file);await cdp.send('HeapProfiler.collectGarbage');report.memory.push({file,heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters'),workers:page.workers().length});}
 await page.screenshot({path:path.join(out,'desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 report.requests=requests;assert.equal(requests.filter(r=>r.method!=='GET'||r.body).length,0);assert.equal(requests.filter(r=>!r.url.startsWith(base)&&!r.url.startsWith('blob:')).length,0);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));await browser.close();console.log('ALL BROWSER CHECKS PASSED');
})().catch(e=>{console.error(e);process.exit(1)});
