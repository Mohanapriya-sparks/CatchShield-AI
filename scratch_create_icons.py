from PIL import Image, ImageDraw

def create_icon(size, filename):
    # Create a blue background
    img = Image.new('RGBA', (size, size), color=(10, 61, 96, 255))
    draw = ImageDraw.Draw(img)
    
    # Draw a white shield-like or simple circle shape in the middle
    margin = size // 5
    draw.ellipse((margin, margin, size-margin, size-margin), fill=(255, 255, 255, 255))
    
    # Draw an inner blue circle
    inner_margin = size // 3
    draw.ellipse((inner_margin, inner_margin, size-inner_margin, size-inner_margin), fill=(10, 61, 96, 255))

    img.save(f'C:/Users/mohan/.gemini/antigravity-ide/scratch/catchshield-ai-public/frontend/public/{filename}')

create_icon(192, 'pwa-192x192.png')
create_icon(512, 'pwa-512x512.png')
create_icon(180, 'apple-touch-icon.png')
