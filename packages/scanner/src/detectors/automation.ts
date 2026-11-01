import type { DetectorModule } from '../types.js';

export const automationDetector: DetectorModule = {
  category: 'automation',

  getInjectionCode(_reportFnName: string): string {
    return `
(function automationDetector(){
  try{
    var origWdDesc=Object.getOwnPropertyDescriptor(Navigator.prototype,'webdriver');
    var origWdGet=origWdDesc&&origWdDesc.get;
    if(origWdGet)_saveToStr(origWdGet);
    Object.defineProperty(Navigator.prototype,'webdriver',{
      get:function(){
        _reportDet({category:'automation',signal:'webdriver_check',weight:0.45,timestamp:Date.now(),details:{}});
        return undefined;
      },
      configurable:true,enumerable:true
    });
  }catch(e){}

  var autoGlobals=['__selenium_unwrapped','_phantom','callPhantom','domAutomation','domAutomationController','_Selenium_IDE_Recorder'];
  autoGlobals.forEach(function(g){
    try{
      Object.defineProperty(window,g,{
        get:function(){
          _reportDet({category:'automation',signal:'automation_globals',weight:0.40,timestamp:Date.now(),details:{global:g}});
          return undefined;
        },
        set:function(){},configurable:true,enumerable:false
      });
    }catch(e){}
  });
  var docGlobals=['__selenium_unwrapped','__webdriver_evaluate','__driver_evaluate'];
  docGlobals.forEach(function(g){
    try{
      Object.defineProperty(document,g,{
        get:function(){
          _reportDet({category:'automation',signal:'automation_globals',weight:0.40,timestamp:Date.now(),details:{global:'document.'+g}});
          return undefined;
        },
        set:function(){},configurable:true,enumerable:false
      });
    }catch(e){}
  });

  try{
    var _origChrome=window.chrome;
    Object.defineProperty(window,'chrome',{
      get:function(){
        _reportDet({category:'automation',signal:'chrome_runtime_probing',weight:0.30,timestamp:Date.now(),details:{}});
        return _origChrome;
      },
      configurable:true,enumerable:true
    });
  }catch(e){}

  try{
    var origGetParam=WebGLRenderingContext.prototype.getParameter;
    _saveToStr(origGetParam);
    WebGLRenderingContext.prototype.getParameter=function(p){
      if(p===0x1F01||p===0x1F00){
        _reportDet({category:'automation',signal:'webgl_renderer_probing',weight:0.35,timestamp:Date.now(),details:{param:p===0x1F01?'RENDERER':'VENDOR'}});
      }
      if(p===0x1F01)return'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630, OpenGL 4.6)';
      if(p===0x1F00)return'Google Inc. (Intel)';
      return origGetParam.call(this,p);
    };
  }catch(e){}
})();`;
  },
};
