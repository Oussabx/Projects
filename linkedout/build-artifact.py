#!/usr/bin/env python3
"""Extract the artifact-ready page (no doctype/html/head/body wrapper) from index.html."""
import re, sys, pathlib
src = pathlib.Path(__file__).parent / 'index.html'
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('/tmp/linkedout-artifact.html')
h = src.read_text()
head = re.search(r'<!-- ARTIFACT-HEAD-START -->(.*?)<!-- ARTIFACT-HEAD-END -->', h, re.S).group(1)
body = re.search(r'<!-- ARTIFACT-BODY-START -->(.*?)<!-- ARTIFACT-BODY-END -->', h, re.S).group(1)
out.write_text(head.strip() + '\n' + body.strip() + '\n')
print(f'{out} ({len(out.read_text())} bytes)')
