# -*- coding: utf-8 -*-
"""Genera el arte paper-cut del login: capas de papel recortado + hojas
tropicales, todo vectorial. Se ejecuta a mano; la salida es images/login/paper-cut.svg."""
import math, random

random.seed(7)
W, H = 620, 820

# Paleta paper-cut, de la capa mas clara (pegada al formulario) a la mas honda
CAPAS = [
    ("#ffffff", 0),      # se funde con el panel del formulario
    ("#eaf0ea", 62),
    ("#c3d3c8", 132),
    ("#8fa89a", 196),
    ("#557763", 254),
]
FONDO = "#223a2c"


def onda(x_base, amplitud, fase, pasos=4):
    """Borde ondulado vertical. La capa se rellena hacia la IZQUIERDA: las
    claras quedan pegadas al formulario y las hondas asoman a la derecha."""
    dy = H / pasos
    d = ["M %.1f %.1f" % (x_base + amplitud * math.sin(fase), -2)]
    for i in range(1, pasos + 1):
        y = -2 + dy * i
        x = x_base + amplitud * math.sin(fase + i * 1.15)
        xc = x_base + amplitud * math.sin(fase + (i - 0.5) * 1.15) + amplitud * 0.9
        d.append("Q %.1f %.1f %.1f %.1f" % (xc, y - dy / 2, x, y))
    d.append("L -20 %d L -20 -2 Z" % (H + 2))
    return " ".join(d)


def hoja_palma(cx, cy, largo, ang, n=13, color="#2b4636", op=1.0):
    """Fronda de palmera: foliolos afinados a lo largo de un raquis curvo."""
    p = ['<g transform="translate(%.1f %.1f) rotate(%.1f)" fill="%s" opacity="%.2f">'
         % (cx, cy, ang, color, op)]
    p.append('<path d="M 0 0 Q %.1f %.1f %.1f %.1f" stroke="%s" stroke-width="3.2" fill="none"/>'
             % (largo * .45, -largo * .12, largo, -largo * .3, color))
    for i in range(n):
        t = (i + 1) / (n + 1.0)
        x = largo * t
        y = -largo * .3 * t * t
        # los del medio son los mas largos
        lf = largo * .30 * math.sin(math.pi * t) ** .75
        for lado in (-1, 1):
            a = lado * (58 - 26 * t)
            p.append('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" '
                     'transform="rotate(%.1f %.1f %.1f)"/>'
                     % (x + lf * .5, y + lado * lf * .28, lf * .55, lf * .12,
                        a, x, y))
    p.append("</g>")
    return "".join(p)


_mid = [0]


def hoja_monstera(cx, cy, r, ang, color="#2b4636", op=1.0):
    """Monstera: blob acorazonado al que una mascara le abre los cortes."""
    _mid[0] += 1
    mid = "mk%d" % _mid[0]
    hoja = ("M 0 0 C %.1f %.1f %.1f %.1f %.1f %.1f C %.1f %.1f %.1f %.1f 0 0 Z"
            % (r * .1, -r * .95, r * .95, -r * .85, r * 1.15, r * .05,
               r * .95, r * .9, r * .1, r * 1.0))
    p = ['<g transform="translate(%.1f %.1f) rotate(%.1f)" opacity="%.2f">' % (cx, cy, ang, op)]
    p.append('<mask id="%s" maskUnits="userSpaceOnUse" x="%.0f" y="%.0f" '
             'width="%.0f" height="%.0f">' % (mid, -r * .3, -r * 1.2, r * 1.8, r * 2.4))
    p.append('<path d="%s" fill="#fff"/>' % hoja)
    # Cada corte es una cuna que entra desde el borde y muere junto al nervio
    for i in range(4):
        t = .22 + i * .19
        for lado in (-1, 1):
            bx = r * 1.05 * t
            by = lado * r * .95 * math.sin(math.pi * t * .85)
            px = bx + r * .30
            py = lado * r * .12
            w = r * .12
            p.append('<path fill="#000" d="M %.1f %.1f L %.1f %.1f Q %.1f %.1f %.1f %.1f Z"/>'
                     % (px, py, bx - w, by * 1.12,
                        bx + w * .4, by * .75, bx + w * 1.5, by * 1.08))
    p.append("</mask>")
    p.append('<path d="%s" fill="%s" mask="url(#%s)"/>' % (hoja, color, mid))
    p.append('<path d="M 0 0 Q %.1f %.1f %.1f %.1f" stroke="#18291f" stroke-width="2" '
             'fill="none" opacity=".35"/>' % (r * .5, -r * .08, r * 1.05, r * .03))
    p.append("</g>")
    return "".join(p)


out = []
out.append('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
           'preserveAspectRatio="xMidYMid slice" role="img" '
           'aria-label="Ilustracion de hojas tropicales en papel recortado">' % (W, H))
out.append('<defs>')
out.append('<filter id="s" x="-30%" y="-30%" width="180%" height="180%">'
           '<feDropShadow dx="9" dy="7" stdDeviation="11" flood-color="#16281e" '
           'flood-opacity=".33"/></filter>')
out.append('<filter id="s2" x="-30%" y="-30%" width="180%" height="180%">'
           '<feDropShadow dx="-5" dy="5" stdDeviation="7" flood-color="#16281e" '
           'flood-opacity=".28"/></filter>')
out.append('<linearGradient id="hondo" x1="0" y1="0" x2="1" y2="1">'
           '<stop offset="0" stop-color="#2a4634"/><stop offset="1" stop-color="#1b3025"/>'
           '</linearGradient>')
out.append('</defs>')

out.append('<rect width="%d" height="%d" fill="url(#hondo)"/>' % (W, H))

# Hojas del fondo, apenas insinuadas dentro de la profundidad
out.append('<g opacity=".5">')
out.append(hoja_palma(430, 150, 300, 35, color="#2f4d3a"))
out.append(hoja_palma(560, 470, 330, 150, color="#2c4936"))
out.append(hoja_monstera(470, 640, 150, -25, color="#2e4b38"))
out.append("</g>")

# Capas de papel, de la mas honda a la mas clara (la clara queda encima)
for color, desp in reversed(CAPAS):
    i = CAPAS.index((color, desp))
    out.append('<path d="%s" fill="%s" filter="url(#s)"/>'
               % (onda(desp, 46 + i * 7, 0.5 + i * 1.35), color))

# Hojas del primer plano: nacen del recorte y se meten sobre el papel claro
out.append('<g filter="url(#s2)">')
out.append(hoja_palma(210, 792, 330, -58, color="#2c4a37"))
out.append(hoja_palma(150, 812, 265, -34, color="#375a44"))
out.append(hoja_monstera(232, 706, 118, -68, color="#24402f"))
out.append(hoja_palma(505, 62, 285, 128, color="#2b4736"))
out.append(hoja_monstera(392, 96, 96, 118, color="#31513d"))
out.append("</g>")

out.append("</svg>")

svg = "".join(out)
open(r"c:\Users\yeise\Downloads\KJA\images\login\paper-cut.svg", "w", encoding="utf-8").write(svg)
print("ok, %.1f KB" % (len(svg.encode("utf-8")) / 1024.0))
