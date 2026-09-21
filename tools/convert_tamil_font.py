from pathlib import Path
from fontTools.ttLib import TTFont

base = Path(r"c:\Users\KolaaPravin\Downloads\New Project\Balu Hari\server\node_modules\@fontsource\noto-sans-tamil\files")
out_dir = Path(r"c:\Users\KolaaPravin\Downloads\New Project\Balu Hari\server\fonts")
out_dir.mkdir(exist_ok=True)

matches = sorted(base.glob("*tamil-400-normal.woff")) + sorted(base.glob("*tamil-700-normal.woff"))
if not matches:
    raise FileNotFoundError(f"No WOFF Tamil fonts found under {base}")

for match in matches:
    font = TTFont(str(match))
    target = out_dir / match.name.replace("-normal.woff", ".ttf")
    font.save(str(target))
    print(f"saved {target}")
