# data_gen.py
import os, random, string
from PIL import Image, ImageDraw, ImageFont
import numpy as np

OUT = "synth_data"
os.makedirs(OUT, exist_ok=True)

# small wordlist (replace with large word list)
words = open("/usr/share/dict/words").read().splitlines() if os.path.exists("/usr/share/dict/words") else ["hello","world","example","openai","ocr","test","python","synthetic","image","recognition","recom","ani"]
fonts = []
# Put some .ttf fonts into ./fonts/ or point to system fonts
font_dir = "fonts"
if os.path.exists(font_dir):
    for f in os.listdir(font_dir):
        if f.lower().endswith(".ttf"):
            fonts.append(os.path.join(font_dir, f))
if not fonts:
    # fallback to PIL default
    fonts = [None]

def random_text(min_len=3, max_len=12):
    return " ".join(random.choice(words) for _ in range(random.randint(1,3)))

def render_image(text, idx):
    w = random.randint(160, 640)
    h = random.randint(32, 128)
    img = Image.new("L", (w,h), color=255)
    draw = ImageDraw.Draw(img)
    font_path = random.choice(fonts)
    font_size = random.randint(18, 48)
    try:
        font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()
    except:
        font = ImageFont.load_default()
    # random x,y
    x = random.randint(2, 10)
    y = random.randint(0, max(0, h - font_size - 1))
    draw.text((x,y), text, font=font, fill=0)
    # optionally add small affine transforms / noise
    arr = np.array(img)
    # small gaussian noise
    if random.random() < 0.3:
        arr = arr + (np.random.randn(*arr.shape) * 6).astype(np.int16)
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(OUT, f"{idx:06d}.png"))
    with open(os.path.join(OUT, f"{idx:06d}.txt"), "w") as fh:
        fh.write(text)

if __name__ == "__main__":
    N = 10000   # generate 10k images for a start
    for i in range(N):
        text = random_text()
        render_image(text, i)
    print("generated", N, "images in", OUT)