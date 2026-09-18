import {defineConfig} from 'vite';
import {createReadStream,existsSync} from 'node:fs';
import {resolve} from 'node:path';
export default defineConfig({
 build:{target:'es2022'},worker:{format:'es'},
 plugins:[{name:'serve-onnx-native-modules',configureServer(server){
  // ORT imports its own ESM loader dynamically. Serve these vendored modules
  // unchanged in development, matching the production static host.
  server.middlewares.use((req,res,next)=>{
   const pathname=(req.url??'').split('?')[0];
   if(!/^\/ort\/[a-zA-Z0-9.-]+\.(mjs|wasm)$/.test(pathname))return next();
   const file=resolve('public','.'+pathname);if(!existsSync(file))return next();
   res.setHeader('Content-Type',pathname.endsWith('.wasm')?'application/wasm':'text/javascript');createReadStream(file).pipe(res);
  });
 }}]
});
