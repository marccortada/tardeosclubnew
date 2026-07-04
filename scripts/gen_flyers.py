#!/usr/bin/env python3
"""Genera flyers verticales de ejemplo (formato cartel 2:3) con el sello estampado.
Reutilizable: python3 scripts/gen_flyers.py"""
import numpy as np, textwrap
from PIL import Image, ImageDraw, ImageFont

def font(sz):
    for p in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf',
              '/System/Library/Fonts/Supplemental/Arial.ttf',
              '/Library/Fonts/Arial.ttf']:
        try: return ImageFont.truetype(p, sz)
        except: pass
    return ImageFont.load_default(sz)

def hex2rgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))

def grad(w,h,c1,c2):
    c1=np.array(hex2rgb(c1)); c2=np.array(hex2rgb(c2))
    y=np.linspace(0,1,h)[:,None]; x=np.linspace(0,1,w)[None,:]
    t=np.clip((x*0.4+y*0.8),0,1)[...,None]
    return Image.fromarray((c1*(1-t)+c2*t).astype('uint8'),'RGB')

sello = Image.open('public/branding/sello.png').convert('RGBA')

data=[
 ('t1','Tardeo Remember Sunset','DJ Nando · DJ Kiko','SAB 11 JUL','Sala Blau · Barcelona','#E10A5A','#F5B301'),
 ('t2','Latino Beach Party','DJ Marta Sound · DJ Rumba Viva','DOM 12 JUL','Chiringuito La Marea','#7A0033','#E10A5A'),
 ('t3','Tardeo del Mar','DJ Sonia','DOM 12 JUL','Terraza Costa · Lloret','#F5B301','#EE3E80'),
 ('t4','Rumba y Salsa Tarde','DJ Rumba Viva','LUN 13 JUL','El Patio Latino · BCN','#C00040','#FBC63A'),
 ('t5','Años 80-90 Fiesta','DJ Kiko · DJ Nando','SAB 18 JUL','Beach Club Sol · Calella','#2A1721','#E10A5A'),
 ('t6','House Sunset Session','DJ Sonia · DJ Marta','DOM 19 JUL','Terraza Costa','#EE3E80','#F5B301'),
 ('t7','Comercial Hits Tarde','DJ Sonia','LUN 20 JUL','Masia Fest · Sant Boi','#E10A5A','#F5B301'),
 ('t8','Gran Tardeo Verano','DJ Nando · DJ Rumba Viva','SAB 25 JUL','Sala Blau · Barcelona','#7A0033','#E10A5A'),
]

W,H=1000,1500
s=sello.copy(); s.thumbnail((230,230), Image.LANCZOS)  # proporción correcta

for id,titulo,dj,fecha,local,c1,c2 in data:
    im=grad(W,H,c1,c2).convert('RGBA'); d=ImageDraw.Draw(im)
    for yy in range(0,H,26):
        for xx in range(0,W,26):
            d.ellipse([xx,yy,xx+3,yy+3],fill=(255,255,255,26))
    veil=Image.new('RGBA',(W,H),(0,0,0,0)); vd=ImageDraw.Draw(veil)
    for i in range(H):
        a=int(max(0,(i-H*0.45)/(H*0.55))*205); vd.line([(0,i),(W,i)],fill=(20,3,15,a))
    im=Image.alpha_composite(im,veil); d=ImageDraw.Draw(im)
    d.text((60,H-430),fecha,font=font(48),fill=hex2rgb('#FBC63A'))
    ft=font(92); y=H-360
    for ln in textwrap.wrap(titulo,width=15):
        d.text((58,y),ln,font=ft,fill='white'); y+=104
    d.text((60,y+10),dj,font=font(44),fill=(255,255,255,235))
    d.text((60,y+70),local,font=font(38),fill=(255,255,255,200))
    im.alpha_composite(s,(W-s.width-40,55))
    im.convert('RGB').save(f'public/flyers/{id}.jpg',quality=88)

print('Flyers regenerados:', len(data), '| sello', s.size)
