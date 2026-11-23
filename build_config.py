"""Only the public API origin is injected into browser builds."""
import json
import os
from urllib.parse import urlsplit


def account_config():
    value = os.environ.get('GAMEWEB_API_URL', 'https://gameweb.76.13.114.33.sslip.io').strip().rstrip('/')
    if value:
        url = urlsplit(value)
        if (url.username or url.password or url.query or url.fragment or url.path
                or not url.hostname or url.scheme not in ('http', 'https')
                or (url.scheme == 'http' and url.hostname not in ('localhost', '127.0.0.1', '::1'))
                or any(char.isspace() for char in value)):
            raise ValueError('GAMEWEB_API_URL must be an HTTPS origin (HTTP is only allowed for local development)')
        # Accessing port also rejects malformed or out-of-range port numbers.
        if url.port == 0:
            raise ValueError('GAMEWEB_API_URL has an invalid port')
    return 'window.ArenaAccountConfig=Object.freeze(' + json.dumps({'apiBaseUrl': value}) + ');\n'
