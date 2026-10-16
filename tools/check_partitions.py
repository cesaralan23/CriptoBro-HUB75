"""Validate the optional USB storage layout without touching a device."""
from pathlib import Path
import csv

ROOT = Path(__file__).resolve().parents[1]

def check():
    rows = list(csv.reader(line for line in (ROOT / 'partitions-media.csv').read_text().splitlines() if line and not line.startswith('#')))
    previous = 0x9000
    entries = {}
    for name, kind, subtype, offset, size in rows:
        offset, size = int(offset, 0), int(size, 0)
        assert offset >= previous and offset % 4096 == 0 and size % 4096 == 0
        if kind == 'app':
            assert offset % 65536 == 0 and size >= 0x180000
        entries[name] = (offset, size)
        previous = offset + size
    assert previous == 4 * 1024 * 1024
    assert entries['nvs'] == (0x9000, 0x5000)
    assert entries['spiffs'][1] == 896 * 1024
    print('USB layout valid: 2 x 1536 KiB firmware, 896 KiB media; NVS unchanged.')

if __name__ == '__main__':
    check()
