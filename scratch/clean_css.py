
import os

path = r'c:\Users\hpillay\Desktop\projects\billing-platform-is\frontend\src\App.css'

with open(path, 'rb') as f:
    content = f.read()

# Filter out null bytes and weird unicode characters
clean_content = content.replace(b'\x00', b'')

with open(path, 'wb') as f:
    f.write(clean_content)

print("Cleanup complete.")
