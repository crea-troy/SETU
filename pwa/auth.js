/**
 * SETU Auth — Supabase Google Login
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your values from:
 * supabase.com → your project → Settings → API
 */
const SUPABASE_URL      = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";
let supabase=null,currentUser=null;
async function initSupabase(){
  if(typeof window.supabase==="undefined")return null;
  supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  const{data:{session}}=await supabase.auth.getSession();
  if(session?.user){currentUser=session.user;await _onLogin(session.user);}
  supabase.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_IN"&&session?.user){currentUser=session.user;await _onLogin(session.user);}
    if(event==="SIGNED_OUT"){currentUser=null;_onLogout();}
  });
  return supabase;
}
async function loginWithGoogle(){
  if(!supabase){alert("Configure Supabase in auth.js first");return;}
  await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin}});
}
async function logout(){if(supabase)await supabase.auth.signOut();}
async function _onLogin(user){
  try{
    const{data:profile}=await supabase.from("profiles").select("*").eq("id",user.id).single();
    const isPro=profile?.plan==="pro"||profile?.plan==="enterprise";
    if(typeof MEMU!=="undefined")MEMU.init(supabase,user.id,isPro);
    _updateUI(user,isPro,profile);
    if(isPro)await _syncLocal(user.id);
  }catch{}
}
function _onLogout(){if(typeof MEMU!=="undefined")MEMU.init(null,null,false);_updateUI(null,false,null);}
async function _syncLocal(uid){
  if(!supabase)return;
  try{
    const local=JSON.parse(localStorage.getItem("setu_memories_v3")||"[]").slice(0,50);
    if(!local.length)return;
    await supabase.from("memories").upsert(local.map(m=>({
      user_id:uid,platform:m.platform||"setu",query:m.query||"",
      summary:m.summary||"",topic:m.topic||"general",lang:m.lang||"en",
      intent:m.intent||"explain",tok_saved:m.saved||0,
    })),{ignoreDuplicates:true});
  }catch{}
}
function _updateUI(user,isPro,profile){
  const s=(id,show)=>{const el=document.getElementById(id);if(el)el.style.display=show?"":"none";};
  s("login-btn",!user);s("logout-btn",user);s("pro-badge",isPro);s("sync-badge",isPro);
  const ui=document.getElementById("user-info");
  if(ui){ui.textContent=user?(profile?.name||user.email?.split("@")[0]||"User"):"";ui.style.display=user?"":"none";}
}
function getUser(){return currentUser;}
function isLoggedIn(){return!!currentUser;}
