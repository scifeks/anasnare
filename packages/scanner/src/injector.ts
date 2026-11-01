import type { DetectorModule, AdContextProvider } from './types.js';

export function generateInjectionScript(
  bindingName: string,
  detectors: DetectorModule[],
  providers: AdContextProvider[],
): string {
  const detectorCode = detectors.map(d => 'try{' + d.getInjectionCode('_reportDet') + '}catch(_e){}').join('\n;');
  const providerCode = providers.map(p => 'try{' + p.getInjectionCode('_reportAd') + '}catch(_e){}').join('\n;');

  return `(function(){` +
`var _JSON_stringify=JSON.stringify;` +
// Spoof toString before any patched function can be inspected
`var _toStrMap=new WeakMap();` +
`var _origToStr=Function.prototype.toString;` +
`function _saveToStr(fn,orig){var src;try{src=_origToStr.call(orig||fn);}catch(e){src='function () { [native code] }';}_toStrMap.set(fn,src);}` +
`function _patchToStr(){` +
  `Function.prototype.toString=function(){` +
    `var saved=_toStrMap.get(this);` +
    `if(saved!==undefined)return saved;` +
    `return _origToStr.call(this);` +
  `};` +
  `_toStrMap.set(Function.prototype.toString,_origToStr.call(_origToStr));` +
`}` +
`function _reportDet(d){` +
  `globalThis['${bindingName}'](_JSON_stringify({type:'det',category:d.category,signal:d.signal,weight:d.weight,timestamp:d.timestamp,details:d.details}));` +
`}` +
`function _reportAd(d){` +
  `globalThis['${bindingName}'](_JSON_stringify({type:'ad',payload:d}));` +
`}` +
// Stealth patches (save originals for toString before patching)
`(function stealthPatches(){` +
  `var navProto=Object.getPrototypeOf(navigator);` +
  `try{` +
    `var origWd=Object.getOwnPropertyDescriptor(navProto,'webdriver');` +
    `if(origWd&&origWd.get)_saveToStr(origWd.get);` +
    `Object.defineProperty(navProto,'webdriver',{` +
      `get:function(){return false;},` +
      `configurable:origWd?origWd.configurable:true,` +
      `enumerable:origWd?origWd.enumerable:true` +
    `});` +
    `_saveToStr(Object.getOwnPropertyDescriptor(navProto,'webdriver').get,origWd&&origWd.get);` +
  `}catch(e){}` +
  `try{` +
    `var origPlugins=Object.getOwnPropertyDescriptor(navProto,'plugins');` +
    `if(origPlugins&&origPlugins.get)_saveToStr(origPlugins.get);` +
    `Object.defineProperty(navProto,'plugins',{` +
      `get:function(){` +
        `return[{name:'Chrome PDF Plugin',filename:'internal-pdf-viewer',description:'Portable Document Format',length:1},` +
        `{name:'Chrome PDF Viewer',filename:'mhjfbmdgcfjbbpaeojofohoefgiehjai',description:'',length:1},` +
        `{name:'Native Client',filename:'internal-nacl-plugin',description:'',length:2}];` +
      `},configurable:true,enumerable:true` +
    `});` +
    `_saveToStr(Object.getOwnPropertyDescriptor(navProto,'plugins').get,origPlugins&&origPlugins.get);` +
  `}catch(e){}` +
  `try{` +
    `var origLangs=Object.getOwnPropertyDescriptor(navProto,'languages');` +
    `if(origLangs&&origLangs.get)_saveToStr(origLangs.get);` +
    `Object.defineProperty(navProto,'languages',{` +
      `get:function(){return['en-US','en'];},configurable:true,enumerable:true` +
    `});` +
    `_saveToStr(Object.getOwnPropertyDescriptor(navProto,'languages').get,origLangs&&origLangs.get);` +
  `}catch(e){}` +
  `try{` +
    `if(!window.chrome)window.chrome={};` +
    `if(!window.chrome.runtime)window.chrome.runtime={connect:function(){},sendMessage:function(){}};` +
  `}catch(e){}` +
  `try{` +
    `var origGetParam=WebGLRenderingContext.prototype.getParameter;` +
    `_saveToStr(origGetParam);` +
    `WebGLRenderingContext.prototype.getParameter=function(p){` +
      `if(p===0x1F01)return'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630, OpenGL 4.6)';` +
      `if(p===0x1F00)return'Google Inc. (Intel)';` +
      `return origGetParam.call(this,p);` +
    `};` +
    `_saveToStr(WebGLRenderingContext.prototype.getParameter,origGetParam);` +
  `}catch(e){}` +
`})();` +
// Activate toString spoofing after all stealth patches applied
`_patchToStr();` +
// Detector modules
detectorCode +
`\n;` +
// Ad context providers
providerCode +
`\n;})();`;
}
