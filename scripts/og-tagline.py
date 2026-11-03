#!/usr/bin/env python3
"""public/og.png のタグライン（左下の2行）だけを差し替える。 実行: python3 scripts/og-tagline.py "1行目" "2行目"
ロゴと右の図は元の画像のまま。要 Pillow と Noto Sans CJK JP（Bold）。変更したら og.png を再公開する。"""
import sys
from PIL import Image, ImageDraw, ImageFont
a, b = sys.argv[1], sys.argv[2]
P = 'public/og.png'
im = Image.open(P).convert('RGB')
d = ImageDraw.Draw(im)
d.rectangle((60, 320, 560, 450), fill=(244, 248, 252))          # 元のタグラインを背景色で消す
f = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 37, index=0)
for i, t in enumerate((a, b)):
    d.text((75, 335 + i * 52), t, font=f, fill=(65, 72, 77))
im.save(P, optimize=True)
