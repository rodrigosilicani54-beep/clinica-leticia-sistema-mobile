from PIL import Image

img = Image.open("logo.png")  # ✅ agora correto
img = img.convert("RGBA")

img.save(
    "icone.ico",
    sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)]
)

print("Ícone criado com sucesso!")