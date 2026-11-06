#!/usr/bin/env python3
"""Generate original fictional instrument hardware; no external CAD assets."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import tempfile

from build123d import (
    Align, Axis, Box, Cylinder, LinearJoint, Location, Pos, RevoluteJoint,
    RigidJoint, Rot, export_stl,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'assets' / 'cad'
Z_MIN = (Align.CENTER, Align.CENTER, Align.MIN)


def parts():
    bezel = Box(96, 96, 4, align=Z_MIN) - Cylinder(38, 12, align=Z_MIN)
    bezel += Pos(0, 0, 4) * (Cylinder(43, 4, align=Z_MIN) - Cylinder(38, 4, align=Z_MIN))
    for x in (-40, 40):
        for y in (-40, 40):
            bezel -= Pos(x, y, 0) * Cylinder(2.4, 9, align=Z_MIN)
    RigidJoint('mount', bezel, Location((0, 0, 0)))

    knob = Cylinder(10.8, 15, align=Z_MIN)
    for n in range(24):
        angle = n * 15
        a = math.radians(angle)
        knob += Pos(10.4 * math.cos(a), 10.4 * math.sin(a), 3) * Rot(0, 0, angle) * Box(2.8, 1.8, 11, align=Z_MIN)
    knob += Pos(0, 0, 15) * Box(3, 17, 2, align=Z_MIN)
    knob += Pos(0, 0, -4) * Cylinder(4, 4, align=Z_MIN)
    RevoluteJoint('command', knob, Axis.Z, angular_range=(-126, 126))

    button = Cylinder(9, 9, align=Z_MIN)
    button += Pos(0, 0, 7) * Cylinder(14, 4, align=Z_MIN)
    button += Pos(0, 0, 11) * Cylinder(12.7, 1.5, align=Z_MIN)
    LinearJoint('acknowledge', button, Axis.Z, linear_range=(-5, 0))
    return {
        'bezel': (bezel, {'type': 'rigid', 'axis': '+Z', 'range': [0, 0]}),
        'knob': (knob, {'type': 'revolute', 'axis': '+Z', 'range': [-126, 126], 'unit': 'degree'}),
        'ack-button': (button, {'type': 'linear', 'axis': '+Z', 'range': [-5, 0], 'unit': 'mm'}),
    }


def generate(destination):
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {'generator': 'build123d 0.13.0', 'units': 'mm', 'sceneScale': .005, 'parts': []}
    for name, (part, joint) in parts().items():
        assert part.is_valid, f'{name}: invalid solid'
        assert len(part.solids()) == 1, f'{name}: expected one connected solid'
        assert part.volume > 0
        path = destination / f'{name}.stl'
        export_stl(part, str(path), tolerance=.18, angular_tolerance=.18, ascii_format=False)
        data = path.read_bytes()
        count = struct.unpack_from('<I', data, 80)[0]
        assert len(data) == 84 + count * 50
        assert 20 < count and len(data) < 400_000, f'{name}: browser mesh budget exceeded'
        box = part.bounding_box()
        manifest['parts'].append({
            'id': name, 'file': path.name, 'triangles': count, 'bytes': len(data),
            'volumeMm3': round(part.volume, 3),
            'boundsMm': [round(v, 3) for v in (*box.min, *box.max)],
            'meshSha256': hashlib.sha256(data[80:]).hexdigest(), 'joint': joint,
        })
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='rebuild in cad/ tempdir and compare committed assets')
    args = parser.parse_args()
    if args.check:
        with tempfile.TemporaryDirectory(prefix='.check-', dir=ROOT / 'cad') as temporary:
            generated = generate(Path(temporary))
            expected = json.loads((OUTPUT / 'manifest.json').read_text())
            assert generated == expected, 'CAD metadata or geometry differs; regenerate exports'
            for item in generated['parts']:
                actual = (OUTPUT / item['file']).read_bytes()
                assert hashlib.sha256(actual[80:]).hexdigest() == item['meshSha256'], f"Corrupt mesh: {item['file']}"
        print('CAD check passed: three valid connected solids, matching mesh geometry and joint metadata')
    else:
        manifest = generate(OUTPUT)
        for item in manifest['parts']:
            print(f"{item['file']}: {item['triangles']} triangles, {item['bytes']} bytes")


if __name__ == '__main__':
    main()
