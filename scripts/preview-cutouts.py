from PIL import Image
from pathlib import Path
for source in ['qa/asset-inspection/record-15.png','qa/asset-inspection/world-19.png','src/assets/mascot/miley-record-complete.png','src/assets/mascot/miley-world-complete.png']:
    im=Image.open(source).convert('RGBA')
    canvas=Image.new('RGBA',im.size,'#f2bdde')
    canvas.alpha_composite(im)
    canvas.convert('RGB').resize((im.width*2,im.height*2)).save('qa/asset-inspection/'+Path(source).stem+'-check.jpg')
