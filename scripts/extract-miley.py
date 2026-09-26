"""Extract original sticker pixels using connected alpha regions, not guessed body polygons."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

root=Path(__file__).resolve().parents[1]
original=Image.open(root/'src/assets/mascot/miley-approved-sheet.png').convert('RGBA')
for name,seed,radius in [('record',(170,640),15),('world',(890,820),19)]:
    alpha=np.array(original.getchannel('A').filter(ImageFilter.MinFilter(radius)))>180
    if name=='record': alpha[779:,:]=False
    visited=np.zeros(alpha.shape,dtype=bool)
    queue=deque([seed])
    while queue:
        x,y=queue.popleft()
        if x<0 or y<0 or x>=original.width or y>=original.height or visited[y,x] or not alpha[y,x]: continue
        visited[y,x]=True
        queue.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    region=Image.fromarray(visited.astype('uint8')*255).filter(ImageFilter.MaxFilter(radius+2))
    if name=='record':
        # Separate the adjoining skateboard sticker below the recorder's shoe outline.
        ImageDraw.Draw(region).polygon([(157,780),(179,777),(209,779),(233,773),(243,780),(1448,790),(1448,1086),(0,1086),(0,790)],fill=0)
    data=np.array(original)
    data[:,:,3]=np.minimum(data[:,:,3],np.array(region))
    result=Image.fromarray(data)
    result=result.crop(result.getbbox())
    padded=Image.new('RGBA',(result.width+32,result.height+32))
    padded.alpha_composite(result,(16,16))
    padded.save(root/f'src/assets/mascot/miley-{name}-v2.png')
    preview=Image.new('RGBA',padded.size,'#f2bdde')
    preview.alpha_composite(padded)
    preview.convert('RGB').resize((padded.width*2,padded.height*2)).save(root/f'qa/asset-inspection/{name}-final.jpg')
