import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalogue from '../src/generated/catalogue.json';
import {search} from '../src/lib/search';
import type {Product} from '../src/lib/product';
test('Baby product terms keep product type constraints',()=>{
 const products=catalogue.products as Product[];
 for(const [q,id] of [['caps','P101'],['baby shall','P102'],['socks','P103'],['diaper sets','P104'],['baby bibs','P105'],['sleeping mat','P106'],['baby swaddle','P107']]){
  assert.deepEqual(search(products,q).products.map(p=>p.product_id),[id]);
 }
 assert.deepEqual(search(products,'caps under 100').products,[]);
});
