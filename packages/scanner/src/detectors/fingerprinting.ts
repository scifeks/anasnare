import type { DetectorModule } from '../types.js';

export const fingerprintingDetector: DetectorModule = {
  category: 'fingerprinting',

  getInjectionCode(_reportFnName: string): string {
    return `
(function fingerprintingDetector(){
  try{
    var origToDataURL=HTMLCanvasElement.prototype.toDataURL;
    _saveToStr(origToDataURL);
    HTMLCanvasElement.prototype.toDataURL=function(){
      _reportDet({category:'fingerprinting',signal:'canvas_fingerprint',weight:0.15,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{method:'toDataURL'}});
      return origToDataURL.apply(this,arguments);
    };
    var origGetImageData=CanvasRenderingContext2D.prototype.getImageData;
    _saveToStr(origGetImageData);
    CanvasRenderingContext2D.prototype.getImageData=function(){
      _reportDet({category:'fingerprinting',signal:'canvas_fingerprint',weight:0.15,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{method:'getImageData'}});
      return origGetImageData.apply(this,arguments);
    };
  }catch(e){}

  try{
    var origHC=Object.getOwnPropertyDescriptor(Navigator.prototype,'hardwareConcurrency');
    if(origHC&&origHC.get){
      _saveToStr(origHC.get);
      Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{
        get:function(){
          _reportDet({category:'fingerprinting',signal:'hardware_concurrency_check',weight:0.12,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
          return 8;
        },configurable:true,enumerable:true
      });
    }
  }catch(e){}
  try{
    Object.defineProperty(Navigator.prototype,'deviceMemory',{
      get:function(){
        _reportDet({category:'fingerprinting',signal:'device_memory_check',weight:0.12,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
        return 8;
      },configurable:true,enumerable:true
    });
  }catch(e){}

  try{
    ['width','height','colorDepth'].forEach(function(prop){
      var orig=Object.getOwnPropertyDescriptor(Screen.prototype,prop);
      if(!orig||!orig.get)return;
      _saveToStr(orig.get);
      var origGet=orig.get;
      Object.defineProperty(Screen.prototype,prop,{
        get:function(){
          _reportDet({category:'fingerprinting',signal:'screen_resolution_check',weight:0.10,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{property:prop}});
          return origGet.call(this);
        },configurable:true,enumerable:true
      });
    });
  }catch(e){}

  try{
    var _clockReads={};
    var origDateNow=Date.now;
    var origPerfNow=performance.now.bind(performance);
    Date.now=function(){
      var src=getCallerScript();
      if(!_clockReads[src])_clockReads[src]={date:0,perf:0};
      _clockReads[src].date=origDateNow();
      if(_clockReads[src].perf&&(origDateNow()-_clockReads[src].perf)<100){
        _reportDet({category:'fingerprinting',signal:'clock_drift_detection',weight:0.10,sourceScript:src,stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
      }
      return _clockReads[src].date;
    };
    performance.now=function(){
      var src=getCallerScript();
      if(!_clockReads[src])_clockReads[src]={date:0,perf:0};
      _clockReads[src].perf=origDateNow();
      if(_clockReads[src].date&&(origDateNow()-_clockReads[src].date)<100){
        _reportDet({category:'fingerprinting',signal:'clock_drift_detection',weight:0.10,sourceScript:src,stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
      }
      return origPerfNow();
    };
  }catch(e){}

  try{
    var origPluginsLen=Object.getOwnPropertyDescriptor(PluginArray.prototype,'length');
    if(origPluginsLen&&origPluginsLen.get){
      _saveToStr(origPluginsLen.get);
      var origPLGet=origPluginsLen.get;
      Object.defineProperty(PluginArray.prototype,'length',{
        get:function(){
          _reportDet({category:'fingerprinting',signal:'plugin_enumeration',weight:0.08,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
          return origPLGet.call(this);
        },configurable:true,enumerable:true
      });
    }
  }catch(e){}

  try{
    var origIntl=Intl.DateTimeFormat.prototype.resolvedOptions;
    _saveToStr(origIntl);
    Intl.DateTimeFormat.prototype.resolvedOptions=function(){
      _reportDet({category:'fingerprinting',signal:'timezone_locale_check',weight:0.08,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
      return origIntl.call(this);
    };
  }catch(e){}

  try{
    var origGetBattery=Navigator.prototype.getBattery;
    if(origGetBattery){
      _saveToStr(origGetBattery);
      Navigator.prototype.getBattery=function(){
        _reportDet({category:'fingerprinting',signal:'battery_api',weight:0.05,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
        return origGetBattery.call(this);
      };
    }
  }catch(e){}

  try{
    var origConn=Object.getOwnPropertyDescriptor(Navigator.prototype,'connection');
    if(origConn&&origConn.get){
      _saveToStr(origConn.get);
      var origConnGet=origConn.get;
      Object.defineProperty(Navigator.prototype,'connection',{
        get:function(){
          _reportDet({category:'fingerprinting',signal:'connection_api',weight:0.05,sourceScript:getCallerScript(),stack:(new Error()).stack||'',timestamp:Date.now(),details:{}});
          return origConnGet.call(this);
        },configurable:true,enumerable:true
      });
    }
  }catch(e){}

  try{
    var origPermsQuery=Permissions.prototype.query;
    if(origPermsQuery){
      _saveToStr(origPermsQuery);
      var _permsCount={};
      Permissions.prototype.query=function(desc){
        var src=getCallerScript();
        _permsCount[src]=(_permsCount[src]||0)+1;
        if(_permsCount[src]>=2){
          _reportDet({category:'fingerprinting',signal:'permissions_probing',weight:0.05,sourceScript:src,stack:(new Error()).stack||'',timestamp:Date.now(),details:{queryCount:_permsCount[src],permission:desc&&desc.name}});
        }
        return origPermsQuery.call(this,desc);
      };
    }
  }catch(e){}
})();`;
  },
};
