import type { DetectorModule, CDPHandler, DetectionEvent } from '../types.js';

export const devtoolsDetector: DetectorModule = {
  category: 'devtools',

  getInjectionCode(_reportFnName: string): string {
    return `
(function devtoolsDetector(){
  var _dimReads={outer:0,inner:0};
  var _dimPollCounts={count:0,firstAt:0};
  function trackDimRead(prop,kind){
    _dimReads[kind]=Date.now();
    if(_dimReads.outer&&_dimReads.inner&&Math.abs(_dimReads.outer-_dimReads.inner)<500){
      _dimPollCounts.count++;
      if(!_dimPollCounts.firstAt)_dimPollCounts.firstAt=Date.now();
      if(_dimPollCounts.count>=3&&(Date.now()-_dimPollCounts.firstAt)<10000){
        _reportDet({category:'devtools',signal:'outerheight_polling',weight:0.80,timestamp:Date.now(),details:{property:prop,pollCount:_dimPollCounts.count}});
        _dimPollCounts={count:0,firstAt:0};
      } else if(_dimPollCounts.count===1){
        _reportDet({category:'devtools',signal:'window_size_differential',weight:0.30,timestamp:Date.now(),details:{property:prop}});
      }
      _dimReads={outer:0,inner:0};
    }
  }
  ['outerHeight','outerWidth','innerHeight','innerWidth'].forEach(function(prop){
    var kind=prop.indexOf('outer')===0?'outer':'inner';
    var orig=Object.getOwnPropertyDescriptor(window,prop);
    if(!orig||!orig.get)return;
    var origGet=orig.get;
    _saveToStr(origGet);
    Object.defineProperty(window,prop,{
      get:function(){trackDimRead(prop,kind);return origGet.call(this);},
      configurable:true,enumerable:true
    });
  });

  var _lastTiming=0;
  var _origPerfNow=performance.now.bind(performance);
  var _origDateNow=Date.now;
  _saveToStr(performance.now);
  ['log','debug','info','warn','error'].forEach(function(m){
    var orig=console[m];
    if(!orig)return;
    _saveToStr(orig);
    console[m]=function(){
      var now=_origDateNow();
      if(now-_lastTiming<50){
        _reportDet({category:'devtools',signal:'console_timing_probe',weight:0.35,timestamp:Date.now(),details:{method:m}});
      }
      return orig.apply(console,arguments);
    };
  });
  performance.now=function(){_lastTiming=_origDateNow();return _origPerfNow();};

  try{
    var consoleProxy=new Proxy(console,{
      set:function(t,p,v){
        _reportDet({category:'devtools',signal:'console_redefinition',weight:0.85,timestamp:Date.now(),details:{property:String(p),action:'set'}});
        t[p]=v;return true;
      },
      defineProperty:function(t,p,d){
        _reportDet({category:'devtools',signal:'console_redefinition',weight:0.85,timestamp:Date.now(),details:{property:String(p),action:'defineProperty'}});
        Object.defineProperty(t,p,d);return true;
      },
      deleteProperty:function(t,p){
        _reportDet({category:'devtools',signal:'console_redefinition',weight:0.85,timestamp:Date.now(),details:{property:String(p),action:'delete'}});
        delete t[p];return true;
      }
    });
    window.console=consoleProxy;
  }catch(e){}

  ['Firebug','_FirebugCommandLine'].forEach(function(p){
    try{
      Object.defineProperty(window,p,{
        get:function(){
          _reportDet({category:'devtools',signal:'firebug_detection',weight:0.08,timestamp:Date.now(),details:{property:p}});
          return undefined;
        },
        set:function(){},configurable:true,enumerable:false
      });
    }catch(e){}
  });
})();`;
  },

  getCDPHandlers(): CDPHandler[] {
    const pauseTracker = new Map<string, { count: number; firstAt: number }>();

    return [{
      event: 'Debugger.paused',
      handler(params: Record<string, unknown>, detections: DetectionEvent[]) {
        if (params.reason !== 'other') return;
        const callFrames = params.callFrames as Array<{
          url: string;
          location: { lineNumber: number; columnNumber: number };
          functionName: string;
        }>;
        const topFrame = callFrames?.[0];
        if (!topFrame) return;

        const locationKey = `${topFrame.url}:${topFrame.location.lineNumber}`;
        const now = Date.now();
        const tracker = pauseTracker.get(locationKey) ?? { count: 0, firstAt: now };
        tracker.count++;

        if (tracker.count >= 3 && (now - tracker.firstAt) < 5000) {
          detections.push({
            category: 'devtools',
            signal: 'debugger_timing_loop',
            weight: 0.95,
            sourceScript: topFrame.url || 'inline',
            stack: callFrames.map(f => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.location.lineNumber}:${f.location.columnNumber})`).join('\n'),
            timestamp: now,
            details: {
              lineNumber: topFrame.location.lineNumber,
              columnNumber: topFrame.location.columnNumber,
              pauseCount: tracker.count,
            },
          });
          pauseTracker.delete(locationKey);
        } else {
          if (tracker.count === 1) {
            detections.push({
              category: 'devtools',
              signal: 'debugger_statement',
              weight: 0.35,
              sourceScript: topFrame.url || 'inline',
              stack: callFrames.map(f => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.location.lineNumber}:${f.location.columnNumber})`).join('\n'),
              timestamp: now,
              details: {
                lineNumber: topFrame.location.lineNumber,
                columnNumber: topFrame.location.columnNumber,
              },
            });
          }
          pauseTracker.set(locationKey, tracker);
        }
      },
    }];
  },
};
