"""Create the release manifest; never includes Wi-Fi credentials or tokens."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def metadata():
    header = (ROOT / "include/version.h").read_text()
    def field(name):
        value = re.search(r'^#define\s+' + name + r'\s+(.+)$', header, re.M)
        if not value:
            raise ValueError(f"Missing {name}")
        return value.group(1).strip().strip('"')
    version = field("FIRMWARE_VERSION")
    if not re.fullmatch(r"\d{1,3}\.\d{1,3}\.\d{1,3}", version):
        raise ValueError("Use MAJOR.MINOR.PATCH, each component 0..999")
    major, minor, patch = map(int, version.split('.'))
    code = int(field("FIRMWARE_VERSION_CODE"))
    if code != major * 1000000 + minor * 1000 + patch:
        raise ValueError("Version and version_code disagree")
    return version, code, field("FIRMWARE_TARGET"), field("UPDATE_REPO")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', type=Path)
    parser.add_argument('--output', type=Path, default=Path('manifest.json'))
    parser.add_argument('--tag-only', action='store_true')
    args = parser.parse_args()
    version, code, target, repo = metadata()
    if args.tag_only:
        print('v' + version)
        return
    if not args.binary:
        parser.error('--binary is required')
    binary = args.binary.read_bytes()
    if not 10000 < len(binary) <= 0x1E0000 or binary[0] != 0xE9:
        raise ValueError('Not a compatible ESP32 app image, or OTA slot exceeded')
    manifest = dict(version=version, version_code=code, target=target,
                    size=len(binary), sha256=hashlib.sha256(binary).hexdigest(),
                    url=f'https://github.com/{repo}/releases/download/v{version}/firmware.bin')
    args.output.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Manifest ready: {version}, {len(binary)} bytes')


if __name__ == '__main__':
    main()
