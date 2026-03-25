"""
SETU Developer API v5
Deploy free on Render.com

Set env vars: SUPABASE_URL, SUPABASE_KEY
Then: python server.py
"""
import os, json, time, hashlib, secrets, sys
try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
except ImportError:
    print("Run: pip install flask flask-cors supabase")
    sys.exit(1)

try:
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"]) \
         if os.environ.get("SUPABASE_URL") else None
except: sb = None

app = Flask(__name__)
CORS(app)

def tok(text):
    h=len([c for c in text if'\u0900'<=c<='\u097F'or'\u0A80'<=c<='\u0AFF'])
    a=len([c for c in text if'\u0600'<=c<='\u06FF'])
    c=len([c for c in text if'\u4E00'<=c<='\u9FFF'or'\uAC00'<=c<='\uD7AF'])
    return max(1,int(h/2+a/1.5+c/1.5+(len(text)-h-a-c)/4))

def auth(req):
    key=(req.headers.get("X-SETU-Key") or req.headers.get("Authorization","").replace("Bearer ","")).strip()
    if not key: return None,jsonify({"error":"Missing API key"}),401
    # In dev mode — accept any key starting with sk_setu_
    if key.startswith("sk_setu_"): return key,None,None
    return None,jsonify({"error":"Invalid API key"}),403

@app.route("/")
@app.route("/api/v1/health")
def health(): return jsonify({"status":"ok","version":"1.0.0","docs":"github.com/crea-troy/setu"})

@app.route("/api/v1/context", methods=["POST"])
def get_context():
    key,err,code=auth(request)
    if err: return err,code
    data=request.json or {}
    uid=data.get("user_id","default")
    query=data.get("query","")
    topic=data.get("topic","general")
    lang=data.get("lang","en")
    max_tok=int(data.get("max_tokens",150))
    if not query: return jsonify({"error":"query required"}),400
    context=""; suggestions=[]
    if sb:
        try:
            mems=sb.table("memories").select("*").eq("user_id",uid).order("created_at",desc=True).limit(100).execute().data or []
            facts=sb.table("facts").select("*").eq("user_id",uid).execute().data or []
            qw=set(query.lower().split())
            scored=sorted(mems,key=lambda m:len(qw&set((m.get("query","")+m.get("summary","")).lower().split()))*0.5+(3 if m.get("topic")==topic else 0),reverse=True)
            parts=[]; tokens=0
            for f in facts[:3]:
                line=f"[{f['concept']}: {f['value']}]";lt=tok(line)
                if tokens+lt<max_tok: parts.append(line);tokens+=lt
            for m in scored[:4]:
                line=f"[{m['platform']} {m['created_at'][:10]}: {(m.get('summary') or m.get('query',''))[:80]}]";lt=tok(line)
                if tokens+lt<max_tok: parts.append(line);tokens+=lt
            context="\n".join(parts)
            suggestions=[f"Asked on {m['platform']}: '{m.get('query','')[:60]}...' — related?" for m in scored[:2] if m.get("platform")!="setu"]
        except Exception as e: return jsonify({"error":str(e)}),500
    return jsonify({"context":context,"suggestions":suggestions,"tokens":tok(context),"user_id":uid})

@app.route("/api/v1/save", methods=["POST"])
def save():
    key,err,code=auth(request)
    if err: return err,code
    data=request.json or {}
    if not data.get("query"): return jsonify({"error":"query required"}),400
    if sb:
        try:
            sb.table("memories").insert({
                "user_id":data.get("user_id","default"),
                "platform":data.get("platform","api"),
                "query":data["query"][:200],
                "summary":data["query"][:150],
                "topic":data.get("topic","general"),
                "lang":data.get("lang","en"),
                "intent":data.get("intent","explain"),
                "tok_saved":int(data.get("tok_saved",0)),
            }).execute()
        except Exception as e: return jsonify({"error":str(e)}),500
    return jsonify({"ok":True})

@app.route("/api/v1/fact", methods=["POST"])
def add_fact():
    key,err,code=auth(request)
    if err: return err,code
    data=request.json or {}
    if not data.get("concept") or not data.get("value"): return jsonify({"error":"concept and value required"}),400
    if sb:
        try:
            sb.table("facts").upsert({"user_id":data.get("user_id","default"),"concept":data["concept"],"value":data["value"]},on_conflict="user_id,concept").execute()
        except Exception as e: return jsonify({"error":str(e)}),500
    return jsonify({"ok":True})

@app.route("/api/v1/user/<uid>", methods=["DELETE"])
def delete_user(uid):
    key,err,code=auth(request)
    if err: return err,code
    if sb:
        try:
            sb.table("memories").delete().eq("user_id",uid).execute()
            sb.table("facts").delete().eq("user_id",uid).execute()
        except Exception as e: return jsonify({"error":str(e)}),500
    return jsonify({"ok":True,"deleted":uid})

@app.route("/api/v1/keys", methods=["POST"])
def create_key():
    data=request.json or {}
    raw=f"sk_setu_{secrets.token_urlsafe(24)}"
    if sb:
        try:
            sb.table("api_keys").insert({
                "key_hash":hashlib.sha256(raw.encode()).hexdigest(),
                "key_prefix":raw[:8],"app_name":data.get("app_name","My App"),
                "plan":"free","monthly_limit":10000,
            }).execute()
        except: pass
    return jsonify({"api_key":raw,"plan":"free","monthly_limit":10000,"docs":"github.com/crea-troy/setu"})

if __name__=="__main__":
    port=int(os.environ.get("PORT",8000))
    print(f"\n✨ SETU API on port {port}")
    print(f"   Health: http://localhost:{port}/api/v1/health\n")
    app.run(host="0.0.0.0",port=port,debug=False)
