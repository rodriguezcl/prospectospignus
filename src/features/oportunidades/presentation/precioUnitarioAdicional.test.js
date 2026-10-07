import {test} from 'node:test';
import assert from 'node:assert/strict';
import {precioUnitarioAdicional} from './precioUnitarioAdicional.js';
const catalogo={esquema:7,items:[{id:'pir',precios:{alto:'100',bajo:'80',telefonico:'60'},precios_pack_2:{bajo:'140'}}]};
test('precio unitario pondera mix y bonificados, y respeta packs',()=>{
 const extra={item_id:'pir',cantidad:3,altos:1,bajos:1,bonificados:1};
 assert.equal(precioUnitarioAdicional(extra,catalogo),'60.00');
 assert.equal(precioUnitarioAdicional({...extra,cantidad:2,altos:0,bajos:2,bonificados:0},catalogo),'70.00');
 assert.equal(precioUnitarioAdicional({...extra,altos:0,bajos:0,bonificados:3},catalogo),'0.00');
 assert.equal(precioUnitarioAdicional({...extra,cantidad:3,altos:1,bajos:0,bonificados:2},catalogo),'33.33');
 assert.equal(precioUnitarioAdicional({...extra,cantidad:0},catalogo),undefined);
});
