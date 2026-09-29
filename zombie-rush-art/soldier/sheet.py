import sys, bpy
a=sys.argv[sys.argv.index('--')+1:]; out=a.pop(0); cols=int(a.pop(0)); files=a
imgs=[bpy.data.images.load(f) for f in files]
w,h=imgs[0].size; rows=(len(imgs)+cols-1)//cols; W,H=w*cols,h*rows
import array
px=array.array('f',[0.0])*(W*H*4)
for i,im in enumerate(imgs):
    ox=(i%cols)*w; oy=(rows-1-i//cols)*h; p=array.array('f',[0.0])*(w*h*4); im.pixels.foreach_get(p)
    for y in range(h):
        d=((oy+y)*W+ox)*4; px[d:d+w*4]=p[y*w*4:(y+1)*w*4]
o=bpy.data.images.new('m',W,H,alpha=True); o.pixels.foreach_set(px); o.filepath_raw=out; o.file_format='PNG'; o.save()
print('SHEET',out,W,H)
