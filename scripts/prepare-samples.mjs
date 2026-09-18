import {mkdir,writeFile} from 'node:fs/promises';
const dir=new URL('../.cache/samples/',import.meta.url);await mkdir(dir,{recursive:true});
const names=['astronaut.png','camera.png','chelsea.png','coffee.png','coins.png','motorcycle_left.png','rocket.jpg','horse.png'];
const sources=names.map(name=>({name,url:`https://raw.githubusercontent.com/scikit-image/scikit-image/v0.22.0/skimage/data/${name}`}));
sources.push({name:'dog.jpg',url:'https://raw.githubusercontent.com/pytorch/hub/master/images/dog.jpg'},{name:'grace_hopper.jpg',url:'https://raw.githubusercontent.com/matplotlib/matplotlib/v3.9.0/lib/matplotlib/mpl-data/sample_data/grace_hopper.jpg'});
for(const source of sources){const r=await fetch(source.url);if(!r.ok)throw Error(source.url);await writeFile(new URL(source.name,dir),new Uint8Array(await r.arrayBuffer()));console.log(source.name);}
await writeFile(new URL('sources.json',dir),JSON.stringify(sources,null,2));
