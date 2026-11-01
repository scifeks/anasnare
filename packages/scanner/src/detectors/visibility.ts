import type { DetectorModule } from '../types.js';

export const visibilityDetector: DetectorModule = {
  category: 'visibility',

  getInjectionCode(_reportFnName: string): string {
    return `
(function visibilityDetector(){
  var _visReads={};
  try{
    var origHidden=Object.getOwnPropertyDescriptor(Document.prototype,'hidden');
    if(origHidden&&origHidden.get){
      _saveToStr(origHidden.get);
      Object.defineProperty(Document.prototype,'hidden',{
        get:function(){
          var src=getCallerScript();
          _visReads[src]=(_visReads[src]||0)+1;
          if(_visReads[src]>3){
            _reportDet({category:'visibility',signal:'visibility_api_abuse',weight:0.05,sourceScript:src,stack:(new Error()).stack||'',timestamp:Date.now(),details:{readCount:_visReads[src]}});
          }
          return false;
        },configurable:true,enumerable:true
      });
    }
  }catch(e){}
  try{
    var origState=Object.getOwnPropertyDescriptor(Document.prototype,'visibilityState');
    if(origState&&origState.get){
      _saveToStr(origState.get);
      Object.defineProperty(Document.prototype,'visibilityState',{
        get:function(){
          var src=getCallerScript();
          _visReads[src]=(_visReads[src]||0)+1;
          if(_visReads[src]>3){
            _reportDet({category:'visibility',signal:'visibility_api_abuse',weight:0.05,sourceScript:src,stack:(new Error()).stack||'',timestamp:Date.now(),details:{readCount:_visReads[src]}});
          }
          return'visible';
        },configurable:true,enumerable:true
      });
    }
  }catch(e){}

  try{
    var origRAF=window.requestAnimationFrame;
    _saveToStr(origRAF);
    window.requestAnimationFrame=function(cb){
      return origRAF.call(window,function(ts){
        var perfCalled=false;
        var origPerfNow=performance.now;
        performance.now=function(){perfCalled=true;return origPerfNow.call(performance);};
        cb(ts);
        performance.now=origPerfNow;
        if(perfCalled){
          _reportDet({category:'visibility',signal:'raf_timing_probe',weight:0.05,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
        }
      });
    };
  }catch(e){}

  try{
    var origAddEvent=EventTarget.prototype.addEventListener;
    _saveToStr(origAddEvent);
    EventTarget.prototype.addEventListener=function(type,listener,opts){
      if(type==='focus'||type==='blur'){
        var src=getCallerScript();
        if(src.indexOf(location.hostname)===-1&&src!=='inline/unknown'){
          _reportDet({category:'visibility',signal:'focus_blur_monitoring',weight:0.05,sourceScript:src,stack:(new Error()).stack||'',timestamp:Date.now(),details:{eventType:type}});
        }
      }
      return origAddEvent.call(this,type,listener,opts);
    };
  }catch(e){}
})();`;
  },
};
