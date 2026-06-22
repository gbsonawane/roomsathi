import os
import glob

pages_dir = r"c:\Users\Admin\Desktop\RoomSathi\frontend\pages"
files_to_edit = [
    "home.js",
    "search.js",
    "profile.js",
    "create-listing.js",
    "listing/[id].js"
]

for file_name in files_to_edit:
    file_path = os.path.join(pages_dir, file_name)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Remove import
        content = content.replace('import Layout from "../components/Layout";\n', '')
        content = content.replace('import Layout from "../../components/Layout";\n', '')
        
        # Remove tags
        content = content.replace('<Layout>', '')
        content = content.replace('</Layout>', '')
        
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {file_name}")
