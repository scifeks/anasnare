import type { AdContextProvider } from '../types.js';

export const vastProvider: AdContextProvider = {
  name: 'vast',

  getInjectionCode(_reportFnName: string): string {
    return `
(function vastEnrichment(){
  function parseVast(xml){
    try{
      var parser=new DOMParser();
      var doc=parser.parseFromString(xml,'text/xml');
      if(!doc.querySelector('VAST'))return null;
      var ads=doc.querySelectorAll('Ad');
      var results=[];
      ads.forEach(function(ad){
        var system=ad.querySelector('AdSystem');
        var title=ad.querySelector('AdTitle');
        var creative=ad.querySelector('Creative');
        var creativeId=creative?creative.getAttribute('id'):null;
        var media=ad.querySelector('MediaFile');
        var wrappers=[];
        var w=ad.querySelector('VASTAdTagURI');
        if(w)wrappers.push(w.textContent.trim());
        results.push({
          adSystem:system?system.textContent.trim():null,
          creativeId:creativeId,
          adTitle:title?title.textContent.trim():null,
          mediaUrl:media?media.textContent.trim():null,
          wrapperChain:wrappers.length?wrappers:null
        });
      });
      return results;
    }catch(e){return null;}
  }

  function reportVast(parsed,scriptUrl){
    if(!parsed)return;
    parsed.forEach(function(ad){
      _reportAd({
        provider:'vast',
        slotId:ad.adSystem||'vast-unknown',
        creativeId:ad.creativeId,
        advertiserId:null,
        advertiserDomain:null,
        lineItemId:null,
        bidder:null,
        bidPrice:null,
        mediaUrl:ad.mediaUrl,
        wrapperChain:ad.wrapperChain,
        scriptUrls:scriptUrl?[scriptUrl]:[],
        timestamp:Date.now()
      });
    });
  }

  try{
    var origXHROpen=XMLHttpRequest.prototype.open;
    var origXHRSend=XMLHttpRequest.prototype.send;
    _saveToStr(origXHROpen);
    _saveToStr(origXHRSend);
    XMLHttpRequest.prototype.open=function(method,url){
      this._vastUrl=url;
      return origXHROpen.apply(this,arguments);
    };
    XMLHttpRequest.prototype.send=function(){
      var self=this;
      this.addEventListener('load',function(){
        try{
          var text=self.responseText;
          if(text&&text.indexOf('<VAST')!==-1){
            reportVast(parseVast(text),self._vastUrl);
          }
        }catch(e){}
      });
      return origXHRSend.apply(this,arguments);
    };
  }catch(e){}

  try{
    var origFetch=window.fetch;
    _saveToStr(origFetch);
    window.fetch=function(){
      var url=arguments[0];
      if(typeof url==='object'&&url.url)url=url.url;
      return origFetch.apply(this,arguments).then(function(response){
        try{
          var clone=response.clone();
          clone.text().then(function(text){
            if(text&&text.indexOf('<VAST')!==-1){
              reportVast(parseVast(text),typeof url==='string'?url:null);
            }
          }).catch(function(){});
        }catch(e){}
        return response;
      });
    };
  }catch(e){}
})();`;
  },
};
