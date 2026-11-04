#!/usr/bin/env python3
"""Fail CI when combined Cobertura line coverage is below the approved floor."""

from __future__ import annotations

import argparse
import glob
import sys
import xml.etree.ElementTree as ET


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pattern", help="Recursive glob for Cobertura XML reports")
    parser.add_argument("minimum", type=float, help="Minimum line coverage percentage")
    args = parser.parse_args()

    reports = sorted(glob.glob(args.pattern, recursive=True))
    if not reports:
        print(f"::error::No Cobertura reports matched {args.pattern}")
        return 2

    covered = 0
    valid = 0
    for report in reports:
        root = ET.parse(report).getroot()
        report_valid = int(root.attrib.get("lines-valid", "0"))
        report_covered = int(root.attrib.get("lines-covered", "0"))
        valid += report_valid
        covered += report_covered
        print(f"Coverage report: {report} ({report_covered}/{report_valid} lines)")

    percentage = (covered / valid * 100) if valid else 0.0
    print(f"Combined line coverage: {percentage:.2f}% (required: {args.minimum:.2f}%)")
    if percentage + 1e-9 < args.minimum:
        print("::error::Backend line coverage is below the approved baseline.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
