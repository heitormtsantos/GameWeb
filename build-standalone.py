"""Build the single-file edition from the modular source. Python standard library only."""
from pathlib import Path
import re
from build_config import account_config

root = Path(__file__).resolve().parent
html = (root / 'index.html').read_text(encoding='utf-8')
def style(match):
    return '<style>\n' + (root / match.group(1)).read_text(encoding='utf-8') + '\n</style>'
def script(match):
    text = (account_config() if match.group(1)=='account-config.js' else (root / match.group(1)).read_text(encoding='utf-8')).replace('</script', '<\\/script')
    return '<script>\n' + text + '\n</script>'
html = re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*/?>', style, html)
html = re.sub(r'<script src="([^"]+)"></script>', script, html)
licenses = '\n\n'.join((root / 'vendor' / name).read_text(encoding='utf-8') for name in ['three.LICENSE.txt','peerjs.LICENSE.txt'])
html = html.replace('</head>', '<!-- Third-party licenses\n' + licenses.replace('--','—') + '\n--></head>')
output = root / 'downloads' / 'block-arena.html'
output.parent.mkdir(exist_ok=True)
output.write_text(html, encoding='utf-8')
print('HTML autônomo:', output)
