import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../src/generated/catalogue.json';
import {gallery} from '../src/lib/gallery';
import type {Product} from '../src/lib/product';
const product=catalogue.products[0] as Product;
test('Empty colour gallery uses that colour illustration, or neutral placeholder when disabled',()=>{
 assert.match(gallery(product,'blue')[0].src,/blue/);
 assert.equal(gallery({...product,illustration_fallback:false},'blue')[0].src,'/images/photo-unavailable.svg');
});
test('Photos stay within selected colour and take precedence over illustrations',()=>{
 const copy=structuredClone(product);
 copy.colour_variants![0].photos=[{src:'/images/pink-front.jpg',alt:'Pink front photo'},{src:'/images/pink-back.jpg',alt:'Pink back photo'}];
 copy.colour_variants![1].photos=[{src:'/images/blue-front.jpg',alt:'Blue front photo'}];
 assert.deepEqual(gallery(copy,'pink').map(p=>p.src),['/images/pink-front.jpg','/images/pink-back.jpg']);
 assert.deepEqual(gallery(copy,'blue').map(p=>p.src),['/images/blue-front.jpg']);
 assert.match(gallery(copy,'pink')[0].fallback,/pink/);
 assert.equal(gallery({...copy,illustration_fallback:false},'pink')[0].fallback,'/images/photo-unavailable.svg');
});
