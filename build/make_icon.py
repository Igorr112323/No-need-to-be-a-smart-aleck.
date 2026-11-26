"""
make_icon.py — генерация иконки OpenLight в стиле Apple
Белая «пилюля с молнией/искрой» на #007AFF скруглённом квадрате (радиус как у macOS ~22%).
Требует Pillow: pip install Pillow
Запуск: python build/make_icon.py
Создаёт assets/openlight.ico (256,128,64,48,32,16) и assets/openlight.png (512)
"""
import pathlib
from PIL import Image, ImageDraw

# Цвета
BLUE = (0, 122, 255, 255)  # #007AFF
WHITE = (255, 255, 255, 255)
BG_TRANSPARENT = (0, 0, 0, 0)

ICON_SIZES = [512, 256, 128, 64, 48, 32, 16]
OUTPUT_ICO = pathlib.Path(__file__).parent.parent / "assets" / "openlight.ico"
OUTPUT_PNG = pathlib.Path(__file__).parent.parent / "assets" / "openlight.png"
# дубли для openlight/assets для совместимости
OUTPUT_ICO2 = pathlib.Path(__file__).parent.parent / "openlight" / "assets" / "openlight.ico"
OUTPUT_PNG2 = pathlib.Path(__file__).parent.parent / "openlight" / "assets" / "openlight.png"

def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    # Pillow >=8 рисует скруглённый прямоугольник
    try:
        draw.rounded_rectangle(xy, radius=radius, fill=fill)
    except AttributeError:
        # fallback — обычный прямоугольник
        draw.rectangle(xy, fill=fill)

def draw_spark(draw, cx, cy, scale=1.0, fill=WHITE):
    """Рисует искру/звезду как в кнопке Оптимизировать: ромб с 4 лучами"""
    # большая искра — 8-точечная звезда
    pts = [
        (cx, cy - 90 * scale),
        (cx + 18 * scale, cy - 22 * scale),
        (cx + 80 * scale, cy),
        (cx + 18 * scale, cy + 22 * scale),
        (cx, cy + 90 * scale),
        (cx - 18 * scale, cy + 22 * scale),
        (cx - 80 * scale, cy),
        (cx - 18 * scale, cy - 22 * scale),
    ]
    draw.polygon(pts, fill=fill)

def draw_small_spark(draw, cx, cy, scale=1.0, fill=WHITE):
    pts = [
        (cx, cy - 28 * scale),
        (cx + 7 * scale, cy - 7 * scale),
        (cx + 28 * scale, cy),
        (cx + 7 * scale, cy + 7 * scale),
        (cx, cy + 28 * scale),
        (cx - 7 * scale, cy + 7 * scale),
        (cx - 28 * scale, cy),
        (cx - 7 * scale, cy - 7 * scale),
    ]
    draw.polygon(pts, fill=fill)

def create_icon_image(size):
    img = Image.new("RGBA", (size, size), BG_TRANSPARENT)
    draw = ImageDraw.Draw(img)
    # фон — скруглённый квадрат 22% радиус (macOS ~ 0.22*size)
    radius = int(size * 0.22)
    # небольшой отступ для тени нет, просто полный
    rounded_rect(draw, (0, 0, size, size), radius=radius, fill=BLUE)

    # глиф — белая «пилюля с искрой» по центру
    # Масштабируем под размер
    scale = size / 512

    # Белая пилюля-капсула (опционально) — нарисуем лёгкий белый овал вокруг искр для эффекта пилюли
    # Пилюля: ширина 260*scale, высота 110*scale, радиус 55*scale — горизонтальная
    # Но для минимализма — просто искры на синем уже выглядят как пилюля с молнией
    # Добавим мягкий белый «ореол» пилюли
    pill_w, pill_h = 280 * scale, 110 * scale
    pill_r = pill_h / 2
    pill_x0 = (size - pill_w) / 2
    pill_y0 = (size - pill_h) / 2 + 8 * scale
    # полупрозрачная белая подложка для пилюли (чтобы выглядела как глиф)
    # Рисуем белую пилюлю с небольшой тенью
    try:
        draw.rounded_rectangle((pill_x0, pill_y0, pill_x0 + pill_w, pill_y0 + pill_h), radius=pill_r, fill=(255, 255, 255, 38))
    except AttributeError:
        draw.ellipse((pill_x0, pill_y0, pill_x0 + pill_h, pill_y0 + pill_h), fill=(255, 255, 255, 38))
        draw.ellipse((pill_x0 + pill_w - pill_h, pill_y0, pill_x0 + pill_w, pill_y0 + pill_h), fill=(255, 255, 255, 38))
        draw.rectangle((pill_x0 + pill_h/2, pill_y0, pill_x0 + pill_w - pill_h/2, pill_y0 + pill_h), fill=(255, 255, 255, 38))

    # Искра большая в центре
    draw_spark(draw, size // 2, size // 2 - 2 * scale, scale=0.95 * scale)
    # две маленькие искры по диагонали
    draw_small_spark(draw, size // 2 + 78 * scale, size // 2 - 68 * scale, scale=0.85 * scale)
    draw_small_spark(draw, size // 2 - 82 * scale, size // 2 + 62 * scale, scale=0.72 * scale)

    return img

def main():
    OUTPUT_ICO.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_ICO2.parent.mkdir(parents=True, exist_ok=True)

    # Создаём 512 для PNG
    img512 = create_icon_image(512)
    img512.save(OUTPUT_PNG, "PNG")
    img512.save(OUTPUT_PNG2, "PNG")
    print(f"✓ {OUTPUT_PNG} ({img512.size})")

    # Для ICO — набор размеров
    images = []
    for sz in ICON_SIZES:
        if sz == 512:
            images.append(img512)
        else:
            images.append(create_icon_image(sz))

    # Pillow сохраняет ICO из самого большого, остальные как append
    # Сохраняем через первый размер 256 как основу
    base = create_icon_image(256)
    # ICO требует sizes параметр
    base.save(OUTPUT_ICO, format="ICO", sizes=[(s, s) for s in ICON_SIZES if s <= 256])
    base.save(OUTPUT_ICO2, format="ICO", sizes=[(s, s) for s in ICON_SIZES if s <= 256])
    print(f"✓ {OUTPUT_ICO} (256,128,64,48,32,16)")
    print("Готово — иконка в стиле Apple: белый глиф на #007AFF, радиус ~22%")

if __name__ == "__main__":
    main()
