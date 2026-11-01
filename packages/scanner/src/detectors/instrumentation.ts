import type { DetectorModule } from '../types.js';

export const instrumentationDetector: DetectorModule = {
  category: 'instrumentation',

  getInjectionCode(_reportFnName: string): string {
    return `
(function instrumentationDetector(){
  var _hookedFns=_toStrMap;
  var _realToString=_origToStr;

  Function.prototype.toString=function(){
    if(_hookedFns.has(this)){
      _reportDet({category:'instrumentation',signal:'tostring_integrity_check',weight:0.90,timestamp:Date.now(),details:{checkedFunction:(_hookedFns.get(this)||'').slice(0,100)}});
    }
    var saved=_hookedFns.get(this);
    if(saved!==undefined)return saved;
    return _realToString.call(this);
  };
  _hookedFns.set(Function.prototype.toString,_realToString.call(_realToString));

  try{
    var _origErrorStack=Object.getOwnPropertyDescriptor(Error.prototype,'stack');
    if(_origErrorStack&&_origErrorStack.get){
      var _origStackGet=_origErrorStack.get;
      Object.defineProperty(Error.prototype,'stack',{
        get:function(){
          var stack=_origStackGet.call(this);
          if(stack&&typeof stack==='string'){
            var lines=stack.split('\\n');
            var hasInspection=lines.some(function(l){return l.indexOf('toString')!==-1||l.indexOf('__anasnare')!==-1;});
            if(hasInspection){
              _reportDet({category:'instrumentation',signal:'error_stack_inspection',weight:0.75,timestamp:Date.now(),details:{stackLength:lines.length}});
            }
          }
          return stack;
        },
        configurable:true
      });
    }
  }catch(e){}

  try{
    var _fnToStr=Function.prototype.toString;
    Object.defineProperty(Function.prototype.toString,'toString',{
      value:function(){
        _reportDet({category:'instrumentation',signal:'tostring_override_detection',weight:0.30,timestamp:Date.now(),details:{}});
        return _realToString.call(_fnToStr);
      }
    });
  }catch(e){}
})();`;
  },
};
