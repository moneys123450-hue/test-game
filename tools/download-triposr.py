import urllib.request, pathlib, time, hashlib, argparse, os
parser=argparse.ArgumentParser(description='Download official public TripoSR weights and verify SHA-256')
parser.add_argument('--out',type=pathlib.Path,default=pathlib.Path(os.environ.get('LOCALAPPDATA',str(pathlib.Path.home())))/'TripoSR'/'weights')
out=parser.parse_args().out;out.mkdir(parents=True,exist_ok=True)
for name,size in [('config.yaml',987),('model.ckpt',1677246742)]:
    dst=out/name
    if dst.exists() and dst.stat().st_size==size:
        print('Already downloaded',name,flush=True);continue
    start=time.time();total=0;last=0
    print('Download',name,flush=True)
    with urllib.request.urlopen('https://huggingface.co/stabilityai/TripoSR/resolve/main/'+name,timeout=60) as r, open(str(dst)+'.partial','wb') as f:
        while chunk:=r.read(4*1024*1024):
            f.write(chunk);total+=len(chunk)
            if total-last>100*1024*1024:
                print(round(total/1024**2),'MB',round(time.time()-start),'seconds',flush=True);last=total
    assert total==size,(total,size)
    pathlib.Path(str(dst)+'.partial').replace(dst)
    if name=='model.ckpt':
        h=hashlib.file_digest(open(dst,'rb'),'sha256').hexdigest()
        assert h=='429e2c6b22a0923967459de24d67f05962b235f79cde6b032aa7ed2ffcd970ee',h
    print('Saved',dst,flush=True)
