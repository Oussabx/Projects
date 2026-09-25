#!/usr/bin/env python3
"""Build Zombie Rush as an Android APK without Gradle or the Android SDK.

Only needs a JDK (javac, keytool) and Python 3. Tools come from Maven Central:
  - dalvik-dx (Java bytecode -> classes.dex)
  - apksig (APK signing, v1 + v2)
  - android 4.1 API stubs (compile classpath for the WebView activity)
The binary manifest and resource table are written by this script.

Usage: python3 build_apk.py            -> dist/zombie-rush.apk
"""

import os
import shutil
import struct
import subprocess
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', 'zombie-rush')
BUILD = os.path.join(HERE, 'build')
TOOLS = os.path.join(HERE, '.tools')
DIST = os.path.join(HERE, 'dist')

PACKAGE = 'com.zombierush.game'
APP_NAME = 'Zombie Rush'
VERSION_CODE = 1
VERSION_NAME = '1.0'
MIN_SDK = 24  # Android 7.0; v2 signing only
TARGET_SDK = 34

KEYSTORE = os.path.join(HERE, 'zombie-rush-test.p12')
KEY_ALIAS = 'zombierush'
KEY_PASS = 'zombierush'

MAVEN = 'https://repo.maven.apache.org/maven2'
JARS = {
    'dx.jar': f'{MAVEN}/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'apksig.jar': f'{MAVEN}/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
    'android.jar': f'{MAVEN}/com/google/android/android/4.1.1.4/android-4.1.1.4.jar',
}

# android.R.attr / android.R.style IDs (read from the API stubs).
ATTR = {
    'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
    'exported': 0x01010010, 'screenOrientation': 0x0101001e, 'configChanges': 0x0101001f,
    'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b, 'versionName': 0x0101021c,
    'targetSdkVersion': 0x01010270, 'hardwareAccelerated': 0x010102d3,
}
THEME_FULLSCREEN = 0x0103000a  # @android:style/Theme.Black.NoTitleBar.Fullscreen
ICON_ID = 0x7f010000           # our @drawable/icon

ANDROID_NS = 'http://schemas.android.com/apk/res/android'
T_REF, T_STRING, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def run(cmd):
    print('+', ' '.join(cmd))
    subprocess.run(cmd, check=True)


def fetch_tools():
    os.makedirs(TOOLS, exist_ok=True)
    for name, url in JARS.items():
        path = os.path.join(TOOLS, name)
        if not os.path.exists(path):
            print('download', url)
            urllib.request.urlretrieve(url, path)


# ---------- Binary XML (AXML) ----------

def string_pool(strings):
    """UTF-16 string pool chunk."""
    offsets, data = [], b''
    for s in strings:
        offsets.append(len(data))
        enc = s.encode('utf-16-le')
        data += struct.pack('<H', len(s)) + enc + b'\x00\x00'
    while len(data) % 4:
        data += b'\x00'
    header = 28
    strings_start = header + 4 * len(strings)
    size = strings_start + len(data)
    return struct.pack('<HHIIIIII', 0x0001, header, size, len(strings), 0, 0, strings_start, 0) + \
        b''.join(struct.pack('<I', o) for o in offsets) + data


def axml(root):
    """Encode a (tag, attrs, children) tree. attrs: list of (name, type, value, android_ns)."""
    # Attribute names with resource IDs go first in the pool, matching the resource map.
    res_names = []

    def collect(node):
        for (n, _t, _v, ns) in node[1]:
            if ns and n not in res_names:
                res_names.append(n)
        for c in node[2]:
            collect(c)
    collect(root)
    strings = list(res_names)

    def idx(s):
        if s not in strings:
            strings.append(s)
        return strings.index(s)

    idx('android'); idx(ANDROID_NS)
    body = b''

    def sort_attrs(attrs):
        return sorted(attrs, key=lambda a: (0, ATTR[a[0]]) if a[3] else (1, a[0]))

    def element(node, line=[1]):
        nonlocal body
        tag, attrs, children = node
        attrs = sort_attrs(attrs)
        packed = b''
        for (n, t, v, ns) in attrs:
            ns_i = idx(ANDROID_NS) if ns else 0xFFFFFFFF
            name_i = idx(n)
            if t == T_STRING:
                raw = idx(v); data = raw
            else:
                raw = 0xFFFFFFFF; data = v & 0xFFFFFFFF
            packed += struct.pack('<IIIHBBI', ns_i, name_i, raw, 8, 0, t, data)
        ext = struct.pack('<IIHHHHHH', 0xFFFFFFFF, idx(tag), 0x14, 0x14, len(attrs), 0, 0, 0)
        chunk = ext + packed
        body += struct.pack('<HHIII', 0x0102, 16, 16 + len(chunk), line[0], 0xFFFFFFFF) + chunk
        line[0] += 1
        for c in children:
            element(c)
        body += struct.pack('<HHIIIII', 0x0103, 16, 24, line[0], 0xFFFFFFFF, 0xFFFFFFFF, idx(tag))
        line[0] += 1

    ns_start = struct.pack('<HHIIIII', 0x0100, 16, 24, 1, 0xFFFFFFFF, idx('android'), idx(ANDROID_NS))
    element(root)
    ns_end = struct.pack('<HHIIIII', 0x0101, 16, 24, 1, 0xFFFFFFFF, idx('android'), idx(ANDROID_NS))
    pool = string_pool(strings)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(res_names)) + b''.join(struct.pack('<I', ATTR[n]) for n in res_names)
    content = pool + resmap + ns_start + body + ns_end
    return struct.pack('<HHI', 0x0003, 8, 8 + len(content)) + content


def manifest():
    A = lambda n, t, v: (n, t, v, True)
    P = lambda n, v: (n, T_STRING, v, False)
    activity = ('activity', [
        A('name', T_STRING, '.MainActivity'),
        A('exported', T_BOOL, 0xFFFFFFFF),
        A('screenOrientation', T_DEC, 1),          # portrait
        A('configChanges', T_HEX, 0x0FB0),         # keep the game running on rotate/resize
        A('theme', T_REF, THEME_FULLSCREEN),
    ], [('intent-filter', [], [
        ('action', [A('name', T_STRING, 'android.intent.action.MAIN')], []),
        ('category', [A('name', T_STRING, 'android.intent.category.LAUNCHER')], []),
    ])])
    app = ('application', [
        A('label', T_STRING, APP_NAME),
        A('icon', T_REF, ICON_ID),
        A('hardwareAccelerated', T_BOOL, 0xFFFFFFFF),
    ], [activity])
    sdk = ('uses-sdk', [A('minSdkVersion', T_DEC, MIN_SDK), A('targetSdkVersion', T_DEC, TARGET_SDK)], [])
    return axml(('manifest', [
        A('versionCode', T_DEC, VERSION_CODE),
        A('versionName', T_STRING, VERSION_NAME),
        P('package', PACKAGE),
    ], [sdk, app]))


# ---------- Resource table (one drawable: the icon) ----------

def resources_arsc():
    glob = string_pool(['res/drawable/icon.png'])
    types = string_pool(['drawable'])
    keys = string_pool(['icon'])
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack('<I', 0)
    config = struct.pack('<I', 64) + b'\x00' * 60
    header = 20 + len(config)
    entries_start = header + 4
    entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STRING, 0)
    type_chunk = struct.pack('<HHIBBHII', 0x0201, header, entries_start + len(entry), 1, 0, 0, 1, entries_start) + \
        config + struct.pack('<I', 0) + entry
    name = PACKAGE.encode('utf-16-le').ljust(256, b'\x00')
    pkg_header = 288
    type_off = pkg_header
    key_off = type_off + len(types)
    pkg_body = types + keys + spec + type_chunk
    pkg = struct.pack('<HHII', 0x0200, pkg_header, pkg_header + len(pkg_body), 0x7f) + name + \
        struct.pack('<IIIII', type_off, 1, key_off, 1, 0) + pkg_body
    content = glob + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(content), 1) + content


# ---------- Build ----------

def render_icon(png_path):
    """Render the game's SVG icon to a 192px PNG with headless Chromium (Playwright)."""
    from playwright.sync_api import sync_playwright
    svg = open(os.path.join(GAME, 'icon.svg')).read()
    exe = os.environ.get('CHROMIUM_PATH')
    with sync_playwright() as p:
        b = p.chromium.launch(**({'executable_path': exe} if exe else {}))
        pg = b.new_page(viewport={'width': 192, 'height': 192})
        pg.set_content(f'<html><body style="margin:0;background:transparent">{svg.replace("<svg ", "<svg width=192 height=192 ", 1)}</body></html>')
        pg.screenshot(path=png_path, omit_background=True, clip={'x': 0, 'y': 0, 'width': 192, 'height': 192})
        b.close()


def write_aligned(z, name, data, align=4):
    """Store an entry uncompressed with an extra field that pads its data to `align` bytes."""
    info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_STORED
    offset = z.fp.tell() + 30 + len(name.encode())
    pad = (-(offset + 4)) % align          # 4 = extra field header
    info.extra = struct.pack('<HH', 0xD935, pad) + b'\x00' * pad
    z.writestr(info, data)


def main():
    fetch_tools()
    shutil.rmtree(BUILD, ignore_errors=True)
    os.makedirs(os.path.join(BUILD, 'classes'))
    os.makedirs(DIST, exist_ok=True)
    jar = lambda n: os.path.join(TOOLS, n)

    # 1. Java -> dex
    run(['javac', '--release', '8', '-nowarn', '-cp', jar('android.jar'), '-d', os.path.join(BUILD, 'classes'),
         os.path.join(HERE, 'src/com/zombierush/game/MainActivity.java')])
    run(['java', '-cp', jar('dx.jar'), 'com.android.dx.command.Main', '--dex', '--min-sdk-version=24', f'--output={os.path.join(BUILD, "classes.dex")}', os.path.join(BUILD, 'classes')])

    # 2. Icon
    icon_png = os.path.join(BUILD, 'icon.png')
    render_icon(icon_png)

    # 3. Unsigned APK
    unsigned = os.path.join(BUILD, 'unsigned.apk')
    with zipfile.ZipFile(unsigned, 'w') as z:
        # Uncompressed entries go first, padded so their data starts on a 4-byte boundary
        # (Android 11+ refuses apps whose resources.arsc is not stored and aligned).
        write_aligned(z, 'resources.arsc', resources_arsc())
        write_aligned(z, 'res/drawable/icon.png', open(icon_png, 'rb').read())
        z.writestr('AndroidManifest.xml', manifest(), zipfile.ZIP_DEFLATED)
        z.write(os.path.join(BUILD, 'classes.dex'), 'classes.dex', zipfile.ZIP_DEFLATED)
        for root, _dirs, files in os.walk(GAME):
            for f in files:
                if f in ('README.md',) or f.startswith('.'):
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, GAME)
                z.write(full, f'assets/www/{rel}', zipfile.ZIP_DEFLATED)

    # 4. Sign (v2). The keystore is reused so new builds install over old ones.
    if not os.path.exists(KEYSTORE):
        run(['keytool', '-genkeypair', '-keystore', KEYSTORE, '-storetype', 'PKCS12', '-alias', KEY_ALIAS,
             '-storepass', KEY_PASS, '-keypass', KEY_PASS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
             '-dname', 'CN=Zombie Rush, O=Zombie Rush, C=US'])
    signer_cp = os.path.join(BUILD, 'signer')
    os.makedirs(signer_cp)
    run(['javac', '-nowarn', '-cp', jar('apksig.jar'), '-d', signer_cp, os.path.join(HERE, 'src/Sign.java')])
    out = os.path.join(DIST, 'zombie-rush.apk')
    run(['java', '--add-exports', 'java.base/sun.security.x509=ALL-UNNAMED', '--add-exports', 'java.base/sun.security.pkcs=ALL-UNNAMED',
         '-cp', os.pathsep.join([signer_cp, jar('apksig.jar')]), 'Sign', unsigned, out, KEYSTORE, KEY_ALIAS, KEY_PASS])
    print(f'\nBuilt {out} ({os.path.getsize(out) // 1024} KB)')


if __name__ == '__main__':
    sys.exit(main())
