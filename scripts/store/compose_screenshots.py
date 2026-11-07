"""Builds App Store screenshots (1320x2868, iPhone 6.9") from raw app screenshots.

Usage: python3 scripts/store/compose_screenshots.py <raw_dir> <out_dir>
<raw_dir> holds 1.png ... 6.png (iPhone screenshots, any size). Output:
<out_dir>/<locale>/<n>.png. Headlines mark the highlighted phrase with *...*.

Assets: Unbounded and Rubik (SIL Open Font License, Google Fonts) and the
SlovakGO mascot cut out from output/brand/*.png.
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1320, 2868
PAD = 18  # horizontal padding inside the yellow marker
ASSETS = Path(__file__).parent / "assets"
PURPLE_TOP, PURPLE_BOTTOM = (86, 64, 210), (120, 94, 238)
YELLOW, INK, WHITE = (255, 210, 31), (33, 25, 70), (255, 255, 255)

HEADLINES = {
    "uk": ["Словацька *для життя*\nв Словаччині", "Короткі уроки\nпро *реальні ситуації*", "Пояснення\n*українською*",
           "Нові слова\n*з прикладами*", "Вправи, що\n*закріплюють знання*", "Від *A0 до C2* —\nпонад 1000 уроків"],
    "ru": ["Словацкий *для жизни*\nв Словакии", "Короткие уроки\nо *реальных ситуациях*", "Понятные *объяснения*\nбез сложных терминов",
           "Новые слова\n*с примерами*", "Упражнения, которые\n*закрепляют знания*", "От *A0 до C2* —\nболее 1000 уроков"],
    "sk": ["Slovenčina *pre život*\nna Slovensku", "Krátke lekcie\no *reálnych situáciách*", "Vysvetlenia\n*v ukrajinčine*",
           "Nové slovíčka\n*s príkladmi*", "Cvičenia, ktoré\n*upevnia vedomosti*", "Od *A0 po C2* —\nviac ako 1000 lekcií"],
    "en": ["Slovak *for real life*\nin Slovakia", "Short lessons on\n*real situations*", "Clear explanations\n*in Ukrainian*",
           "New words\n*with examples*", "Practice that\n*makes it stick*", "From *A0 to C2* —\n1000+ lessons"],
}
# The mascot speaks Slovak on every card, whatever the store language.
BUBBLES = ["Ahoj!", "Poďme na to!", "Dobrý deň!", "Nové slovíčka!", "Výborne!", "Si super!"]
MASCOTS = ["mascot-wave.png", "mascot-wink.png"]
PHONE_W = 960


def font(name: str, size: int, weight: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(ASSETS / name), size)
    f.set_variation_by_name(weight)
    return f


def background(seed: int) -> Image.Image:
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        draw.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(PURPLE_TOP, PURPLE_BOTTOM)))
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    left = seed % 2 == 0
    g.ellipse([-420 if left else W - 680, 900, 680 if left else W + 420, 2000], fill=(160, 140, 255, 70))
    g.ellipse([W - 520 if left else -260, -260, W + 260 if left else 520, 520], fill=(255, 255, 255, 28))
    img = Image.alpha_composite(img.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(120)))
    return img


def sparkle(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int, fill) -> None:
    k = r * 0.28
    draw.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k),
                  (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=fill)


def headline(canvas: Image.Image, text: str) -> int:
    """Draws centred lines with *highlighted* phrases; returns the bottom y."""
    draw = ImageDraw.Draw(canvas)
    lines = [[(seg, i % 2 == 1) for i, seg in enumerate(line.split("*")) if seg] for line in text.split("\n")]
    size = 100
    while True:
        f = font("Unbounded.ttf", size, "Bold")
        widths = [sum(draw.textlength(seg, font=f) + (2 * PAD if hot else 0) for seg, hot in line) for line in lines]
        if max(widths) <= W - 150 or size <= 56:
            break
        size -= 4
    line_h = round(size * 1.32)
    y = 200
    for line, width in zip(lines, widths):
        x = (W - width) / 2
        for seg, hot in line:
            if hot:  # yellow marker behind the highlighted phrase
                seg_w = draw.textlength(seg, font=f)
                draw.rounded_rectangle([x, y + size * 0.1, x + seg_w + 2 * PAD, y + size * 1.2], radius=24, fill=YELLOW)
                draw.text((x + PAD, y), seg, font=f, fill=INK)
                x += seg_w + 2 * PAD
            else:
                draw.text((x, y), seg, font=f, fill=WHITE)
                x += draw.textlength(seg, font=f)
        y += line_h
    return y


def phone(canvas: Image.Image, shot: Path, top: int, x: int) -> tuple[int, int, int]:
    phone_w = PHONE_W
    raw = Image.open(shot).convert("RGB")
    phone_h = round(raw.height * phone_w / raw.width)
    mask = Image.new("L", (phone_w, phone_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, phone_w, phone_h], radius=96, fill=255)
    screen = raw.resize((phone_w, phone_h), Image.LANCZOS).convert("RGBA")
    screen.putalpha(mask)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x - 10, top + 40, x + phone_w + 10, top + phone_h + 80], radius=116, fill=(25, 12, 70, 140))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(50)))
    bezel = Image.new("RGBA", (phone_w + 40, phone_h + 40), (0, 0, 0, 0))
    ImageDraw.Draw(bezel).rounded_rectangle([0, 0, phone_w + 40, phone_h + 40], radius=116, fill=(24, 18, 48, 255))
    canvas.alpha_composite(bezel, (x - 20, top - 20))
    canvas.alpha_composite(screen, (x, top))
    return x, top, phone_w


def sticker(name: str, width: int, flip: bool) -> Image.Image:
    m = Image.open(ASSETS / name).convert("RGBA")
    if flip:
        m = m.transpose(Image.FLIP_LEFT_RIGHT)
    m = m.resize((width, round(m.height * width / m.width)), Image.LANCZOS)
    pad = 40
    out = Image.new("RGBA", (m.width + pad * 2, m.height + pad * 2), (0, 0, 0, 0))
    alpha = Image.new("L", out.size, 0)
    alpha.paste(m.getchannel("A"), (pad, pad))
    outline = alpha.filter(ImageFilter.MaxFilter(17)).filter(ImageFilter.GaussianBlur(1.5))
    shadow = Image.new("RGBA", out.size, (20, 10, 60, 0))
    shadow.putalpha(ImageChops.offset(outline, 0, 14).filter(ImageFilter.GaussianBlur(16)).point(lambda a: a * 0.45))
    out.alpha_composite(shadow)
    out.paste(WHITE + (255,), (0, 0), outline)
    out.alpha_composite(m, (pad, pad))
    return out


def bubble(canvas: Image.Image, text: str, anchor_x: int, bottom: int, tail_right: bool) -> None:
    draw = ImageDraw.Draw(canvas)
    f = font("Rubik.ttf", 64, "Bold")
    tw = draw.textlength(text, font=f)
    bw, bh = round(tw + 96), 132
    x = min(max(anchor_x - bw // 2, 40), W - bw - 40)
    y = bottom - bh
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x, y + 14, x + bw, y + bh + 14], radius=66, fill=(20, 10, 60, 90))
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))
    draw.rounded_rectangle([x, y, x + bw, y + bh], radius=66, fill=WHITE)
    tx = x + bw * (0.72 if tail_right else 0.28)
    draw.polygon([(tx - 26, y + bh - 4), (tx + 26, y + bh - 4), (tx + (34 if tail_right else -34), y + bh + 46)], fill=WHITE)
    draw.text((x + bw / 2, y + bh / 2 + 2), text, font=f, fill=INK, anchor="mm")


def compose(shot: Path, text: str, index: int) -> Image.Image:
    canvas = background(index)
    draw = ImageDraw.Draw(canvas)
    for cx, cy, r in [(110, 150, 26), (1235, 560, 30), (180, 760, 18), (1240, 1500, 22)]:
        sparkle(draw, cx, cy, r, YELLOW + (230,))
    bottom = headline(canvas, text)
    on_left = index % 2 == 0  # the mascot stands on this side, the phone shifts away from it
    phone_x = W - PHONE_W - 50 if on_left else 50
    phone(canvas, shot, max(bottom + 80, 600), phone_x)

    m = sticker(MASCOTS[index % 2], 440, flip=not on_left)
    mx = -60 if on_left else W - m.width + 60
    my = 2060
    canvas.alpha_composite(m, (mx, my))
    bubble(canvas, BUBBLES[index % len(BUBBLES)], mx + m.width // 2 + (90 if on_left else -90), my + 40, tail_right=not on_left)
    return canvas.convert("RGB")


def main(raw_dir: str, out_dir: str) -> None:
    shots = sorted(Path(raw_dir).glob("*.png"), key=lambda p: int(p.stem) if p.stem.isdigit() else 99)
    for locale, texts in HEADLINES.items():
        dest = Path(out_dir) / locale
        dest.mkdir(parents=True, exist_ok=True)
        for i, shot in enumerate(shots):
            compose(shot, texts[i % len(texts)], i).save(dest / f"{i + 1}.png")
    print(f"{len(shots)} screenshots x {len(HEADLINES)} locales -> {out_dir}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
