/**
 * SETU Cost Tracker
 * Tracks tokens WITH vs WITHOUT SETU
 * Shows real money saved
 */
const COST = (() => {
  const KEY = "setu_cost_v3";
  const P = {claude:0.009,chatgpt:0.005,perplexity:0.001,grok:0.002,gemini:0.004,default:0.005};
  function u(t,m){return t/1000*(P[m]||P.default);}
  function fmt(n){
    if(n<0.0001)return"$0.0000";
    if(n<0.01)return"$"+n.toFixed(4);
    if(n<1)return"$"+n.toFixed(3);
    return"$"+n.toFixed(2);
  }
  function load(){try{return JSON.parse(localStorage.getItem(KEY)||"{}");}catch{return{};}}
  function persist(d){localStorage.setItem(KEY,JSON.stringify(d));}

  function record(model,tokOrig,tokOpt){
    const outSaved = Math.round(250*0.35); // est output token saving
    const saved    = Math.max(0,tokOrig-tokOpt) + outSaved;
    const usdSaved = u(outSaved,model) + u(Math.max(0,tokOrig-tokOpt),model)*0.2;
    const today    = new Date().toISOString().slice(0,10);
    const d        = load();
    d.totalTokOrig  = (d.totalTokOrig  || 0) + tokOrig;
    d.totalTokOpt   = (d.totalTokOpt   || 0) + tokOpt;
    d.totalSaved    = (d.totalSaved    || 0) + saved;
    d.totalQueries  = (d.totalQueries  || 0) + 1;
    d.totalUSD      = (d.totalUSD      || 0) + usdSaved;
    if(!d.daily)d.daily={};
    if(!d.daily[today])d.daily[today]={orig:0,opt:0,saved:0,q:0,usd:0};
    d.daily[today].orig  += tokOrig;
    d.daily[today].opt   += tokOpt;
    d.daily[today].saved += saved;
    d.daily[today].q     += 1;
    d.daily[today].usd   += usdSaved;
    const keys=Object.keys(d.daily).sort().slice(-30);
    const nd={};keys.forEach(k=>nd[k]=d.daily[k]);d.daily=nd;
    persist(d);
    return { saved, usdSaved: fmt(usdSaved) };
  }

  function preview(tokOrig,tokOpt,model){
    const outSaved=Math.round(250*0.35);
    const saved=Math.max(0,tokOrig-tokOpt)+outSaved;
    const pct=Math.round(saved/(tokOrig+250)*100);
    return{
      tokOrig,tokOpt,saved,pct,
      origUSD: fmt(u(tokOrig+250,model)),
      optUSD:  fmt(u(tokOpt+163,model)),
      savedUSD:fmt(u(outSaved,model)+u(Math.max(0,tokOrig-tokOpt),model)*0.2),
    };
  }

  function getStats(){
    const d=load(),daily=d.daily||{};
    const today=new Date().toISOString().slice(0,10);
    const thisM=new Date().toISOString().slice(0,7);
    const tod=daily[today]||{saved:0,q:0,usd:0};
    let mSaved=0,mQ=0,mUSD=0;
    Object.entries(daily).forEach(([k,v])=>{
      if(k.startsWith(thisM)){mSaved+=v.saved||0;mQ+=v.q||0;mUSD+=v.usd||0;}
    });
    const ratio=d.totalTokOrig>0?Math.round(d.totalSaved/d.totalTokOrig*100):0;
    return{
      totalTokOrig:d.totalTokOrig||0,totalTokOpt:d.totalTokOpt||0,
      totalSaved:d.totalSaved||0,totalQueries:d.totalQueries||0,
      totalUSD:fmt(d.totalUSD||0),ratio,
      todaySaved:tod.saved,todayUSD:fmt(tod.usd||0),todayQ:tod.q,
      monthSaved:mSaved,monthUSD:fmt(mUSD),monthQ:mQ,
    };
  }

  return{record,preview,getStats,fmt};
})();
if(typeof module!=="undefined")module.exports=COST;
