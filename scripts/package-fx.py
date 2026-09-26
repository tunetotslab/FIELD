from pathlib import Path
from PIL import Image, ImageDraw
import json

root=Path(__file__).resolve().parents[1]
out=root/'src/assets/effects'
out.mkdir(parents=True,exist_ok=True)
sheet=Image.new('RGB',(900,960),'#fffaf7')
for i,(name,path) in enumerate(json.loads((root/'scripts/fx-sources.json').read_text()).items()):
    im=Image.open(path).convert('RGBA')
    print(name,im.size,im.getchannel('A').getextrema())
    # Preserve generated alpha and the entire silhouette; only scale for mobile delivery.
    bounds=im.getchannel('A').getbbox()
    cropped=im.crop(bounds)
    cropped.thumbnail((288,288),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(320,320))
    canvas.alpha_composite(cropped,((320-cropped.width)//2,(320-cropped.height)//2))
    canvas.save(out/f'{name}.webp',quality=94,method=6)
    preview=canvas.resize((280,280))
    x,y=(i%3)*300,(i//3)*320
    sheet.paste(preview,(x+10,y),preview)
    ImageDraw.Draw(sheet).text((x+115,y+290),name.upper(),fill='black')
sheet.save(root/'qa/fx-contact-sheet.jpg')
