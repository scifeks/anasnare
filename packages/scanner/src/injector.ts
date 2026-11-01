import type { DetectorModule, AdContextProvider } from './types.js';

export function generateInjectionScript(
  detectionReportFn: string,
  adSlotReportFn: string,
  detectors: DetectorModule[],
  providers: AdContextProvider[],
): string {
  const detectorCode = detectors.map(d => 'try{' + d.getInjectionCode('_reportDet') + '}catch(_e){}').join('\n;');
  const providerCode = providers.map(p => 'try{' + p.getInjectionCode('_reportAd') + '}catch(_e){}').join('\n;');

  return `(function(){` +
`var _JSON_stringify=JSON.stringify;` +
`var _setTimeout=setTimeout;` +
`var _Error=Error;` +
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
// Queue and flush for detection events
`var _detQ=[];` +
`function _reportDet(d){` +
  `if(!d.stack)d.stack=new _Error().stack||'';` +
  `if(!d.detected_at)d.detected_at=new Date().toISOString();` +
  `try{window['${detectionReportFn}'](_JSON_stringify(d));}` +
  `catch(e){_detQ.push(d);` +
    `if(_detQ.length===1){(function poll(){_setTimeout(function(){try{_flushDet();}catch(e2){poll();}},50);})();}` +
  `}` +
`}` +
`function _flushDet(){while(_detQ.length){var item=_detQ[0];window['${detectionReportFn}'](_JSON_stringify(item));_detQ.shift();}}` +
`window.__anasnare_flushDet=_flushDet;` +
// Queue and flush for ad slot events
`var _adQ=[];` +
`function _reportAd(d){` +
  `try{window['${adSlotReportFn}'](_JSON_stringify(d));}` +
  `catch(e){_adQ.push(d);` +
    `if(_adQ.length===1){(function poll(){_setTimeout(function(){try{_flushAd();}catch(e2){poll();}},50);})();}` +
  `}` +
`}` +
`function _flushAd(){while(_adQ.length){var item=_adQ[0];window['${adSlotReportFn}'](_JSON_stringify(item));_adQ.shift();}}` +
`window.__anasnare_flushAd=_flushAd;` +
// Caller script helper
`var _marker='__anasnare_iife__';` +
`function getCallerScript(){` +
  `var s=(new _Error()).stack||'';` +
  `var f=s.split('\\n').slice(2);` +
  `for(var i=0;i<f.length;i++){` +
    `var m=f[i].match(/https?:\\/\\/[^\\s\\)]+/);` +
    `if(m&&m[0].indexOf(_marker)===-1)return m[0];` +
  `}` +
  `return 'inline/unknown';` +
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
