"""Stage only public runtime assets for GitHub Pages, never node_modules or tests."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parent
target=root/'site'
target.mkdir(exist_ok=True)
assets=['index.html','styles.css','theme.css','runtime.js','combat-state.js','controls.js','controls-ui.js','avatars.js','avatar-motion.js','browser-ui.js','game.js']
for name in assets:shutil.copy2(root/name,target/name)
for name in ['vendor','downloads']:shutil.copytree(root/name,target/name,dirs_exist_ok=True)
(target/'.nojekyll').touch()
print('Public site staged:',len(assets),'runtime files + vendor/downloads')
