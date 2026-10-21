import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:8787';
const token=(await readFile('.dev.vars','utf8')).match(/LOCAL_ADMIN_TOKEN=(.+)/)[1].trim();
const headers={Origin:base,'Content-Type':'application/json','CF-Connecting-IP':`test-${crypto.randomUUID()}`};
const post=(path,data,extra={})=>fetch(base+path,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(data)});
const input={product_id:'P101',name:'API test',avatar:'initial',rating:4,review:'Temporary review API validation fixture.',consent:true,website:''};
const created=[];
try{
 for(const bad of [{...input,consent:false},{...input,rating:6},{...input,website:'spam'},{...input,verified:true},{...input,product_id:'P9999'}])assert.equal((await post('/api/reviews/submit',bad)).status,400);
 for(let i=0;i<3;i++){const response=await post('/api/reviews/submit',input);assert.equal(response.status,201);created.push(await response.json());}
 assert.equal((await post('/api/reviews/submit',input)).status,429);
 let list=(await(await post('/api/reviews/list',{})).json()).reviews;
 assert.ok(created.every(r=>!list.some(p=>p.id===r.id)));
 const record=created[0];
 await post('/api/reviews/withdraw',{id:record.id,token:'wrong'});
 const pending=await(await fetch(base+'/internal/api/reviews',{headers:{Authorization:`Bearer ${token}`}})).json();
 assert.ok(pending.reviews.some(r=>r.id===record.id));
 await post('/internal/api/reviews',{id:record.id,status:'approved'},{Authorization:`Bearer ${token}`});
 list=(await(await post('/api/reviews/list',{})).json()).reviews;
 const published=list.find(r=>r.id===record.id);assert.ok(published);assert.equal(published.deletion_hash,undefined);assert.equal(published.verification_source,undefined);
 await post('/api/reviews/withdraw',record);
 list=(await(await post('/api/reviews/list',{})).json()).reviews;assert.ok(!list.some(r=>r.id===record.id));
 console.log('Review API checks passed: validation, no verification spoofing, rate limit, moderation boundary, private fields, withdrawal token.');
}finally{for(const r of created)await post('/internal/api/reviews',{id:r.id,status:'delete'},{Authorization:`Bearer ${token}`});}
