"""Validate YOLO detection annotations and optionally clamp coordinates."""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


IMAGE_EXTENSIONS = {".bmp", ".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}


@dataclass
class ValidationSummary:
    files_checked: int = 0
    rows_checked: int = 0
    invalid_rows: int = 0
    repaired_rows: int = 0
    missing_labels: int = 0
    missing_images: int = 0


def discover(root: Path, extensions: set[str]) -> list[Path]:
    if not root.is_dir():
        raise FileNotFoundError(f"Directory does not exist: {root}")
    return sorted(
        (path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in extensions),
        key=lambda path: str(path).casefold(),
    )


def index_by_stem(paths: Iterable[Path], kind: str) -> dict[str, Path]:
    index: dict[str, Path] = {}
    for path in paths:
        if path.stem in index:
            raise ValueError(
                f"Duplicate {kind} stem '{path.stem}': {index[path.stem]} and {path}"
            )
        index[path.stem] = path
    return index


def class_count(classes_file: Path | None, explicit_count: int | None) -> int:
    if explicit_count is not None:
        if explicit_count <= 0:
            raise ValueError("--num-classes must be positive.")
        return explicit_count
    if classes_file is None or not classes_file.is_file():
        raise FileNotFoundError("Provide --num-classes or a valid --classes file.")
    names = [
        line.strip()
        for line in classes_file.read_text(encoding="utf-8-sig").splitlines()
        if line.strip()
    ]
    if not names:
        raise ValueError(f"No classes found in {classes_file}")
    return len(names)


def format_row(class_id: int, coordinates: list[float]) -> str:
    values = " ".join(f"{value:.10g}" for value in coordinates)
    return f"{class_id} {values}\n"


def validate_label(path: Path, num_classes: int, repair: bool, summary: ValidationSummary) -> None:
    original_lines = path.read_text(encoding="utf-8-sig").splitlines()
    output_lines: list[str] = []
    file_changed = False

    for line_number, raw_line in enumerate(original_lines, start=1):
        summary.rows_checked += 1
        parts = raw_line.split()
        prefix = f"{path}:{line_number}"
        if len(parts) != 5:
            summary.invalid_rows += 1
            print(f"ERROR {prefix}: expected 5 fields, found {len(parts)}")
            output_lines.append(raw_line + "\n")
            continue

        try:
            class_id = int(parts[0])
        except ValueError:
            summary.invalid_rows += 1
            print(f"ERROR {prefix}: class ID is not an integer: {parts[0]!r}")
            output_lines.append(raw_line + "\n")
            continue

        try:
            coordinates = [float(value) for value in parts[1:]]
        except ValueError:
            summary.invalid_rows += 1
            print(f"ERROR {prefix}: bounding-box values must be numeric")
            output_lines.append(raw_line + "\n")
            continue

        if not all(math.isfinite(value) for value in coordinates):
            summary.invalid_rows += 1
            print(f"ERROR {prefix}: bounding-box values must be finite")
            output_lines.append(raw_line + "\n")
            continue

        row_invalid = False
        row_repaired = False
        if not 0 <= class_id < num_classes:
            row_invalid = True
            print(f"ERROR {prefix}: class ID {class_id} is outside [0, {num_classes - 1}]")

        outside = [value for value in coordinates if not 0.0 <= value <= 1.0]
        if outside:
            if repair:
                repaired = [min(1.0, max(0.0, value)) for value in coordinates]
                print(f"REPAIRED {prefix}: {coordinates} -> {repaired}")
                coordinates = repaired
                summary.repaired_rows += 1
                row_repaired = True
                file_changed = True
            else:
                row_invalid = True
                print(f"ERROR {prefix}: normalized values outside [0, 1]: {outside}")

        if coordinates[2] <= 0.0 or coordinates[3] <= 0.0:
            row_invalid = True
            print(f"ERROR {prefix}: width and height must be greater than zero")

        if row_invalid:
            summary.invalid_rows += 1
        output_lines.append(format_row(class_id, coordinates) if row_repaired else raw_line + "\n")

    if repair and file_changed:
        path.write_text("".join(output_lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate YOLO label rows and image-label pairing.")
    parser.add_argument("--images", type=Path, required=True, help="Directory containing images.")
    parser.add_argument("--labels", type=Path, required=True, help="Directory containing YOLO labels.")
    parser.add_argument(
        "--classes",
        type=Path,
        default=Path("classes.txt"),
        help="One-class-per-line file used to determine valid IDs (default: classes.txt).",
    )
    parser.add_argument("--num-classes", type=int, help="Override the class count from --classes.")
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Rewrite label files after clamping finite normalized values into [0, 1].",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    num_classes = class_count(args.classes, args.num_classes)
    image_index = index_by_stem(discover(args.images, IMAGE_EXTENSIONS), "image")
    label_index = index_by_stem(discover(args.labels, {".txt"}), "label")
    summary = ValidationSummary()

    for stem in sorted(set(image_index) - set(label_index)):
        summary.missing_labels += 1
        print(f"ERROR image without label: {image_index[stem]}")
    for stem in sorted(set(label_index) - set(image_index)):
        summary.missing_images += 1
        print(f"ERROR label without image: {label_index[stem]}")

    for label in label_index.values():
        summary.files_checked += 1
        validate_label(label, num_classes, args.repair, summary)

    print("\nValidation summary")
    print(f"  label files checked: {summary.files_checked}")
    print(f"  rows checked: {summary.rows_checked}")
    print(f"  invalid rows remaining: {summary.invalid_rows}")
    print(f"  repaired rows: {summary.repaired_rows}")
    print(f"  images without labels: {summary.missing_labels}")
    print(f"  labels without images: {summary.missing_images}")

    has_errors = summary.invalid_rows or summary.missing_labels or summary.missing_images
    return 1 if has_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
