#!/usr/bin/env python3
"""Extract PNG images from macOS .icns files.

ICNS types ic07-ic10 contain raw PNG data. This script parses the ICNS
container and writes out the embedded PNGs at their native resolutions.

Usage: icns_extract.py <input.icns> <output_dir>
"""
import struct
import sys
import os

# ICNS types that contain PNG data and their nominal sizes
ICNS_PNG_TYPES = {
    b'ic07': 128,
    b'ic08': 256,
    b'ic09': 512,
    b'ic10': 1024,
}

PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'


def extract_icns(icns_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    extracted = []

    with open(icns_path, 'rb') as f:
        magic = f.read(4)
        if magic != b'icns':
            print(f"Error: {icns_path} is not a valid ICNS file", file=sys.stderr)
            sys.exit(1)

        total_size = struct.unpack('>I', f.read(4))[0]

        while f.tell() < total_size:
            icon_type = f.read(4)
            if len(icon_type) < 4:
                break
            icon_size = struct.unpack('>I', f.read(4))[0]
            data_size = icon_size - 8
            data = f.read(data_size)

            if icon_type in ICNS_PNG_TYPES and data[:8] == PNG_SIGNATURE:
                size = ICNS_PNG_TYPES[icon_type]
                out_path = os.path.join(output_dir, f'{size}.png')
                with open(out_path, 'wb') as out:
                    out.write(data)
                extracted.append((size, out_path))
                print(f"  Extracted {size}x{size} -> {out_path}")

    return extracted


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <input.icns> <output_dir>", file=sys.stderr)
        sys.exit(1)

    results = extract_icns(sys.argv[1], sys.argv[2])
    if not results:
        print("Error: No PNG icons found in ICNS file", file=sys.stderr)
        sys.exit(1)
    print(f"  Extracted {len(results)} icons")
