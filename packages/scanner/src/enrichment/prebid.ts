import type { AdContextProvider } from '../types.js';

export const prebidProvider: AdContextProvider = {
  name: 'prebid',

  getInjectionCode(_reportFnName: string): string {
    return `
(function prebidEnrichment(){
  function tryHook(){
    if(!window.pbjs||!window.pbjs.onEvent)return false;
    window.pbjs.onEvent('bidWon',function(bid){
      var scriptUrls=[];
      try{
        var adUnit=window.pbjs.adUnits&&window.pbjs.adUnits.find(function(u){return u.code===bid.adUnitCode;});
        if(adUnit&&adUnit.bids){
          adUnit.bids.forEach(function(b){
            if(b.bidder===bid.bidderCode&&b.params&&b.params.tagId)scriptUrls.push(b.params.tagId);
          });
        }
      }catch(e){}
      _reportAd({
        provider:'prebid',
        slotId:bid.adUnitCode||'unknown',
        creativeId:bid.creativeId||null,
        advertiserId:null,
        advertiserDomain:(bid.meta&&bid.meta.advertiserDomains&&bid.meta.advertiserDomains[0])||null,
        lineItemId:null,
        bidder:bid.bidderCode||null,
        bidPrice:bid.cpm||null,
        mediaUrl:null,
        wrapperChain:null,
        scriptUrls:scriptUrls,
        timestamp:Date.now()
      });
    });
    return true;
  }
  if(!tryHook()){
    var attempts=0;
    var poll=setInterval(function(){
      if(tryHook()||++attempts>20)clearInterval(poll);
    },500);
  }
})();`;
  },
};
