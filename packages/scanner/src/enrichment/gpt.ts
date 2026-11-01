import type { AdContextProvider } from '../types.js';

export const gptProvider: AdContextProvider = {
  name: 'gpt',

  getInjectionCode(_reportFnName: string): string {
    return `
(function gptEnrichment(){
  function tryHook(){
    if(!window.googletag||!window.googletag.pubads)return false;
    try{
      window.googletag.pubads().addEventListener('slotRenderEnded',function(evt){
        var slot=evt.slot;
        var scriptUrls=[];
        try{
          var iframe=document.getElementById(slot.getSlotElementId());
          if(iframe){
            var scripts=iframe.querySelectorAll?iframe.querySelectorAll('script[src]'):[];
            scripts.forEach(function(s){scriptUrls.push(s.src);});
          }
        }catch(e){}
        _reportAd({
          provider:'gpt',
          slotId:slot.getAdUnitPath()||slot.getSlotElementId()||'unknown',
          creativeId:evt.creativeId?String(evt.creativeId):null,
          advertiserId:evt.advertiserId?String(evt.advertiserId):null,
          advertiserDomain:null,
          lineItemId:evt.lineItemId?String(evt.lineItemId):null,
          bidder:null,
          bidPrice:null,
          mediaUrl:null,
          wrapperChain:null,
          scriptUrls:scriptUrls,
          timestamp:Date.now()
        });
      });
    }catch(e){}
    return true;
  }
  if(!tryHook()){
    var cmd=window.googletag&&window.googletag.cmd;
    if(cmd&&cmd.push){cmd.push(function(){tryHook();});}
    else{
      var attempts=0;
      var poll=setInterval(function(){
        if(tryHook()||++attempts>20)clearInterval(poll);
      },500);
    }
  }
})();`;
  },
};
