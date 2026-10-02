import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSync} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {crearRepositorioCatalogo} from '../infrastructure/crearRepositorioCatalogo.js';
import {menu} from '../../../app/navegacion/menu.js';
test('productos: ruta administrativa y carga real sin catálogo ficticio',()=>{
 const resultado=buildSync({entryPoints:[fileURLToPath(new URL('./ProductosPagina.jsx',import.meta.url))],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
 const modulo={exports:{}};new Function('require','module','exports',resultado.outputFiles[0].text)(createRequire(import.meta.url),modulo,modulo.exports);
 const html=renderToStaticMarkup(createElement(modulo.exports.ProductosPagina,{gestion:{}}));
 assert.match(html,/Productos/);assert.match(html,/Cargar catálogo/);assert.doesNotMatch(html,/449999|AXPRO/);
 const grupo=menu.find(g=>g.elementos.some(e=>e.ruta==='/productos'));
 assert.equal(grupo.soloAdministrador,true);assert.equal(Boolean(grupo.plegable),false);
});
test('productos: puerto envía versión e idempotencia, no identidad de actor',async()=>{
 const llamadas=[];const repo=crearRepositorioCatalogo({rpc:async(...args)=>{llamadas.push(args);return {data:{version:0,datos:{familias:[],items:[]}}};}});
 await repo.leer();await repo.guardar({version:0,operacion:'op',datos:{familias:[],items:[]}});
 assert.deepEqual(llamadas[0],['leer_catalogo',{p_oportunidad:null}]);
 assert.deepEqual(Object.keys(llamadas[1][1]),['p_version','p_operacion','p_datos']);
 await assert.rejects(crearRepositorioCatalogo({rpc:async()=>({error:{message:'CATALOGO_CONFLICTO'}})}).leer(),/cambió/);
});
