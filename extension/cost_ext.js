const COST=(()=>{
  const P={claude:0.009,chatgpt:0.005,perplexity:0.001,grok:0.002,gemini:0.004,default:0.005};
  function u(t,m){return t/1000*(P[m]||P.default);}
  function fmt(n){if(n<0.0001)return"$0.0000";if(n<0.01)return"$"+n.toFixed(4);if(n<1)return"$"+n.toFixed(3);return"$"+n.toFixed(2);}
  async function record(model,tokOrig,tokOpt){
    const outSaved=Math.round(250*0.35),saved=Math.max(0,tokOrig-tokOpt)+outSaved;
    const usdSaved=u(outSaved,model)+u(Math.max(0,tokOrig-tokOpt),model)*0.2;
    const today=new Date().toISOString().slice(0,10);
    const data=await chrome.storage.local.get(["totalTokOrig","totalTokOpt","totalSaved","totalQueries","totalUSD","dailyStats"]);
    const daily=data.dailyStats||{};
    if(!daily[today])daily[today]={orig:0,opt:0,saved:0,q:0,usd:0};
    daily[today].orig+=tokOrig;daily[today].opt+=tokOpt;daily[today].saved+=saved;daily[today].q+=1;daily[today].usd+=usdSaved;
    const keys=Object.keys(daily).sort().slice(-30);const nd={};keys.forEach(k=>nd[k]=daily[k]);
    await chrome.storage.local.set({
      totalTokOrig:(data.totalTokOrig||0)+tokOrig,
      totalTokOpt:(data.totalTokOpt||0)+tokOpt,
      totalSaved:(data.totalSaved||0)+saved,
      totalQueries:(data.totalQueries||0)+1,
      totalUSD:(data.totalUSD||0)+usdSaved,
      dailyStats:nd,
    });
    return{saved,usdSaved:fmt(usdSaved)};
  }
  function preview(tokOrig,tokOpt,model){
    const outSaved=Math.round(250*0.35),saved=Math.max(0,tokOrig-tokOpt)+outSaved;
    return{tokOrig,tokOpt,saved,pct:Math.round(saved/(tokOrig+250)*100),
      origUSD:fmt(u(tokOrig+250,model)),optUSD:fmt(u(tokOpt+163,model)),
      savedUSD:fmt(u(outSaved,model)+u(Math.max(0,tokOrig-tokOpt),model)*0.2)};
  }
  return{record,preview,fmt};
})();
