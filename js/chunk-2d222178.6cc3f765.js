(window["webpackJsonp"]=window["webpackJsonp"]||[]).push([["chunk-2d222178"],{ccac:function(e,t,n){"use strict";n.r(t),n.d(t,"createLabelFunction",(function(){return f})),n.d(t,"formatField",(function(){return b}));var r=n("ce50"),a=n("e92d"),u=n("4653"),i=n("21e2"),l=n("c1da"),c=n("7b39"),s=n("82fa");const o=a["a"].getLogger("esri.layers.support.labelFormatUtils"),d={type:"simple",evaluate:()=>null},p={getAttribute:(e,t)=>e.field(t)};async function f(e,t,a){if(!e||!e.symbol)return d;const u=e.where,i=Object(c["b"])(e),l=u?await n.e("chunk-2d0d03a7").then(n.bind(null,"66a2")):null;let f;if("arcade"===i.type){const e=await Object(s["c"])(i.expression,a,t);f={type:"arcade",evaluate(t){try{const n=e.evaluate({$feature:"attributes"in t?e.repurposeFeature(t):e.repurposeAdapter(t)});if(null!=n)return n.toString()}catch(a){o.error(new r["a"]("bad-arcade-expression","Encountered an error when evaluating label expression for feature",{feature:t,expression:i}))}return null},needsHydrationToEvaluate:()=>null==Object(c["e"])(i.expression)}}else f={type:"simple",evaluate:e=>i.expression.replace(/{[^}]*}/g,n=>{const r=n.slice(1,-1),a=t.get(r);if(!a)return n;let u=null;return"attributes"in e?e&&e.attributes&&(u=e.attributes[a.name]):u=e.field(a.name),null==u?"":b(u,a)})};if(u){let e;try{e=l.WhereClause.create(u,t)}catch(y){return d}const n=f.evaluate;f.evaluate=t=>{const r="attributes"in t?void 0:p;return e.testFeature(t,r)?n(t):null}}return f}function b(e,t){if(null==e)return"";const n=t.domain;if(n)if("codedValue"===n.type||"coded-value"===n.type){const t=e;for(const e of n.codedValues)if(e.code===t)return e.name}else if("range"===n.type){const t=+e,r="range"in n?n.range[0]:n.minValue,a="range"in n?n.range[1]:n.maxValue;if(r<=t&&t<=a)return n.name}let r=e;return"date"===t.type||"esriFieldTypeDate"===t.type?r=Object(u["b"])(r,Object(u["a"])("short-date")):Object(l["q"])(t)&&(r=Object(i["b"])(+r)),r||""}}}]);
//# sourceMappingURL=chunk-2d222178.6cc3f765.js.map