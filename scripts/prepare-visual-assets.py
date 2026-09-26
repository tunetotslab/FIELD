"""Prepare display derivatives; original artwork remains untouched."""
from pathlib import Path
from collections import deque
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'src/assets'

def component(mask, seed):
    h, w = mask.shape
    result = np.zeros_like(mask, dtype=bool)
    queue = deque([seed])
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or result[y,x] or not mask[y,x]:
            continue
        result[y,x] = True
        queue.extend(((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
    return result

def save_trimmed(im, name):
    bounds = im.getbbox()
    im = im.crop(bounds)
    padded = Image.new('RGBA', (im.width+12, im.height+12))
    padded.paste(im, (6,6))
    padded.save(ROOT / name)

logo = Image.open(ROOT/'brand/tune-tots-logo.png').convert('RGBA')
pixels = np.array(logo)
pixels[:,:,3] = 255 - pixels[:,:,:3].min(axis=2)
pixels[:,:,:3] = 0
save_trimmed(Image.fromarray(pixels), 'brand/tune-tots-transparent.png')

word = Image.open(ROOT/'brand/field-wordmark.png').convert('RGBA')
p = np.array(word)
rgb = p[:,:,:3].astype(int)
edge = ((rgb.max(2)-rgb.min(2)>27) | (rgb.max(2)<135)).astype('uint8')*255
edge = Image.fromarray(edge).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
mask = np.array(edge)>0
mask[:4,:] = mask[-4:,:] = False
mask[:,:4] = mask[:,-4:] = False
outside = component(~mask, (0,0))
alpha = Image.fromarray((~outside).astype('uint8')*255)
# Open the D counter without altering the hanging liquid-metal stroke inside it.
hole = Image.new('L', word.size)
ImageDraw.Draw(hole).polygon([(818,218),(845,231),(864,262),(867,302),(851,341),(829,356),(805,352),(793,329),(792,300),(808,309),(832,303),(834,282),(825,263)], fill=255)
alpha = Image.fromarray(np.minimum(np.array(alpha),255-np.array(hole)))
p[:,:,3] = np.array(alpha.filter(ImageFilter.GaussianBlur(.6)))
save_trimmed(Image.fromarray(p), 'brand/field-wordmark-transparent.png')

sheet = Image.open(ROOT/'mascot/miley-approved-sheet.png').convert('RGBA')
print('Sheet:', sheet.size, 'alpha range:', sheet.getchannel('A').getextrema())
# Isolate complete stickers from the approved sheet, retaining their original outline.
for name, box, polygon in [
    ('record', (48,538,379,793), [(x-48,y-538) for x,y in [(62,711),(72,687),(66,659),(70,629),(85,600),(88,575),(110,560),(134,553),(159,553),(184,558),(207,570),(227,587),(237,591),(238,567),(253,548),(280,539),(310,540),(336,553),(352,576),(357,604),(344,628),(319,645),(305,652),(295,669),(311,669),(333,680),(354,682),(373,700),(377,730),(370,750),(347,761),(305,773),(267,780),(242,780),(232,777),(213,783),(183,782),(166,778),(145,786),(119,783),(94,773),(78,757),(63,743)]]),
    ('world', (782,737,1123,994), [(7,167),(25,147),(35,116),(22,99),(24,74),(36,52),(47,29),(73,19),(89,4),(113,2),(144,3),(159,18),(174,26),(188,43),(201,69),(200,95),(181,111),(195,141),(213,164),(241,177),(248,195),(233,215),(207,229),(175,234),(158,233),(152,251),(132,257),(110,255),(88,239),(46,227),(17,216),(2,197)]),
]:
    crop = sheet.crop(box)
    mask = Image.new('L', crop.size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    data = np.array(crop)
    data[:,:,3] = np.minimum(data[:,:,3],np.array(mask))
    if name == 'record':
        data[:22,:185,3] = 0  # Adjacent sticker baseline above the sun's complete rays.
    eroded = np.array(Image.fromarray(data[:,:,3]).filter(ImageFilter.MinFilter(3)))>128
    connected = component(eroded, (110,110))
    connected = Image.fromarray(connected.astype('uint8')*255).filter(ImageFilter.MaxFilter(5))
    data[:,:,3] = np.minimum(data[:,:,3], np.array(connected))
    save_trimmed(Image.fromarray(data), f'mascot/miley-{name}-complete.png')
