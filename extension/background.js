chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg.type==="CAPTURE"){
    chrome.storage.local.get("memories").then(data=>{
      const list=data.memories||[];
      list.unshift({id:Date.now(),ts:Date.now(),platform:msg.platform,
        query:(msg.text||"").slice(0,200),summary:(msg.text||"").slice(0,150),
        topic:msg.topic||"general",lang:msg.lang||"en",intent:msg.intent||"explain",saved:0});
      if(list.length>300)list.splice(300);
      chrome.storage.local.set({memories:list});
    });
  }
  return true;
});
