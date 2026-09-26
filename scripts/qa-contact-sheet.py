from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[1]/'qa/final'
sheet=Image.new('RGB',(1234,912),'#ece9e7')
for i,name in enumerate(['home','fx','world']):
    im=Image.open(root/f'{name}-390.png').convert('RGB')
    im=im.resize((390,844),Image.Resampling.LANCZOS)
    sheet.paste(im,(16+i*406,48))
    ImageDraw.Draw(sheet).text((24+i*406,20),{'home':'HOME','fx':'CHROME FX','world':'FIELD WORLD'}[name],fill='#111111')
sheet.save(root/'overview.jpg',quality=94)
