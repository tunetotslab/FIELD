from PIL import Image, ImageFilter
import numpy as np
from collections import deque
from pathlib import Path

im = Image.open('src/assets/mascot/miley-approved-sheet.png').convert('RGBA')
root = Path('qa/asset-inspection')
root.mkdir(parents=True, exist_ok=True)
for radius in [11,15]:
    a = np.array(im.getchannel('A').filter(ImageFilter.MinFilter(radius)))>180
    for name, seed in [('record',(170,640)),('world',(890,820))]:
        if name == 'record':
            a[780:,:] = False
        seen = np.zeros(a.shape, dtype=bool)
        q = deque([seed])
        while q:
            x,y = q.popleft()
            if x<0 or y<0 or x>=im.width or y>=im.height or seen[y,x] or not a[y,x]: continue
            seen[y,x]=True
            q.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
        mask = Image.fromarray(seen.astype('uint8')*255).filter(ImageFilter.MaxFilter(radius+2))
        data = np.array(im)
        data[:,:,3] = np.minimum(data[:,:,3],np.array(mask))
        out = Image.fromarray(data)
        print(name,radius,out.getbbox())
        out.crop(out.getbbox()).save(root/f'{name}-{radius}.png')
