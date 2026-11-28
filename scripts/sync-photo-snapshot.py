"""Refresh the GitHub Pages photo snapshot (public/memories + public/data/memories.json) from the live Cloudflare site.
Usage: python3 scripts/sync-photo-snapshot.py [site-url]"""
import json,sys,urllib.request,pathlib
SITE=(sys.argv[1] if len(sys.argv)>1 else 'https://ust35-campus-memories.ust35-campus-memories.workers.dev').rstrip('/')
# Cloudflare rejects the default Python user agent.
open_url=lambda path,t:urllib.request.urlopen(urllib.request.Request(SITE+path,headers={'User-Agent':'ust35-snapshot-sync/1.0'}),timeout=t)
root=pathlib.Path(__file__).resolve().parent.parent/'public'
folder=root/'memories';folder.mkdir(exist_ok=True)
items=json.load(open_url('/api/memories',60))
keep=set();out=[]
for m in items:
    with open_url(m['photo'],120) as r:
        ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[r.headers.get_content_type()];data=r.read()
    name=f"{m['id']}.{ext}";(folder/name).write_bytes(data);keep.add(name)
    out.append({k:m[k] for k in ('id','title','story','date','point')}|{'photo':'memories/'+name})
for f in folder.iterdir():
    if f.name not in keep:f.unlink()
(root/'data'/'memories.json').write_text(json.dumps(out,ensure_ascii=False,indent=1)+'\n')
print(len(out),'photos synced')
