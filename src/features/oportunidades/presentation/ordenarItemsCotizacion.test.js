import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarItemsCotizacion } from './ordenarItemsCotizacion.js';

test('marca primero y COMPONENTES al final, A-Z en cada grupo sin mutar selecciones', () => {
 const catalogo={marcas:[{id:'h',nombre:'HIKVISION'},{id:'c',nombre:'COMPONENTES'}],items:[{id:'1',nombre:'SIM',marca_id:'c'},{id:'2',nombre:'PIR',marca_id:'h'},{id:'3',nombre:'Cartel',marca_id:'c'},{id:'4',nombre:'Álimentador',marca_id:'h'},{id:'5',nombre:'Control',marca_id:'h'}]};
 const filas=catalogo.items.map((i)=>({item_id:i.id,cantidad:2}));
 const original=structuredClone({catalogo,filas});
 assert.deepEqual(ordenarItemsCotizacion(filas,catalogo).map(i=>i.item_id),['4','5','2','3','1']);
 assert.deepEqual(ordenarItemsCotizacion(catalogo.items,catalogo).map(i=>i.id),['4','5','2','3','1']);
 assert.deepEqual({catalogo,filas},original);
 assert.equal(ordenarItemsCotizacion(filas,catalogo)[0],filas[3]);
});
test('usa nombres del snapshot y admite referencias históricas faltantes',()=>{
 const filas=[{item_id:'z',nombre:'Zeta'},{item_id:'a',nombre:'Álamo'}];
 assert.deepEqual(ordenarItemsCotizacion(filas,{items:[]}).map(i=>i.item_id),['a','z']);
});
