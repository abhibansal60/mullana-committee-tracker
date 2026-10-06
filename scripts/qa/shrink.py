# Palette-quantize screenshots in place so they're cheap to commit.
import sys
from pathlib import Path
from PIL import Image
for d in sys.argv[1:]:
    for f in Path(d).glob("*.png"):
        Image.open(f).convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT).save(f, optimize=True)
