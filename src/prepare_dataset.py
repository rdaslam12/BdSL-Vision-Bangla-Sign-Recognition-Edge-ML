"""Create a deterministic Ultralytics YOLO train/validation dataset split."""

from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path
from typing import Iterable


IMAGE_EXTENSIONS = {".bmp", ".gif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"}


def discover_files(root: Path, extensions: set[str]) -> list[Path]:
    """Return files below *root* whose suffix is in *extensions*."""
    if not root.is_dir():
        raise FileNotFoundError(f"Directory does not exist: {root}")
    return sorted(
        (path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in extensions),
        key=lambda path: str(path).casefold(),
    )


def index_by_stem(paths: Iterable[Path], kind: str) -> dict[str, Path]:
    """Index paths by filename stem and reject ambiguous duplicate stems."""
    index: dict[str, Path] = {}
    duplicates: dict[str, list[Path]] = {}
    for path in paths:
        key = path.stem
        if key in index:
            duplicates.setdefault(key, [index[key]]).append(path)
        else:
            index[key] = path

    if duplicates:
        details = "\n".join(
            f"  {stem}: {', '.join(str(path) for path in matches)}"
            for stem, matches in sorted(duplicates.items())
        )
        raise ValueError(f"Duplicate {kind} stems would overwrite output files:\n{details}")
    return index


def prepare_output(output: Path, source_roots: Iterable[Path], overwrite: bool) -> None:
    output_resolved = output.resolve()
    for source_root in source_roots:
        source_resolved = source_root.resolve()
        if (
            source_resolved == output_resolved
            or source_resolved.is_relative_to(output_resolved)
            or output_resolved.is_relative_to(source_resolved)
        ):
            raise ValueError(f"Output and source directories cannot contain one another: {output}")

    if output.exists() and any(output.iterdir()):
        if not overwrite:
            raise FileExistsError(
                f"Output directory is not empty: {output}. Pass --overwrite to replace it."
            )
        shutil.rmtree(output)

    for relative in ("images/train", "images/val", "labels/train", "labels/val"):
        (output / relative).mkdir(parents=True, exist_ok=True)


def copy_pairs(pairs: list[tuple[Path, Path]], output: Path, split: str) -> None:
    for image, label in pairs:
        shutil.copy2(image, output / "images" / split / image.name)
        shutil.copy2(label, output / "labels" / split / f"{image.stem}.txt")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Pair YOLO images and labels, then create a deterministic train/val split."
    )
    parser.add_argument("--images", type=Path, required=True, help="Directory containing images.")
    parser.add_argument("--labels", type=Path, required=True, help="Directory containing YOLO labels.")
    parser.add_argument("--output", type=Path, required=True, help="Output dataset directory.")
    parser.add_argument("--train-ratio", type=float, default=0.8, help="Training fraction (default: 0.8).")
    parser.add_argument("--seed", type=int, default=42, help="Shuffle seed (default: 42).")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace a non-empty output directory after safety checks.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not 0.0 < args.train_ratio < 1.0:
        raise ValueError("--train-ratio must be between 0 and 1 (exclusive).")

    images = discover_files(args.images, IMAGE_EXTENSIONS)
    labels = discover_files(args.labels, {".txt"})
    image_index = index_by_stem(images, "image")
    label_index = index_by_stem(labels, "label")

    missing_labels = sorted(set(image_index) - set(label_index))
    missing_images = sorted(set(label_index) - set(image_index))
    print(f"Discovered {len(images)} images and {len(labels)} label files.")
    print(f"Missing labels: {len(missing_labels)}")
    for stem in missing_labels:
        print(f"  image without label: {image_index[stem]}")
    print(f"Missing images: {len(missing_images)}")
    for stem in missing_images:
        print(f"  label without image: {label_index[stem]}")

    paired_stems = sorted(set(image_index) & set(label_index))
    pairs = [(image_index[stem], label_index[stem]) for stem in paired_stems]
    if not pairs:
        raise ValueError("No matching image-label pairs were found.")

    random.Random(args.seed).shuffle(pairs)
    split_index = int(args.train_ratio * len(pairs))
    train_pairs = pairs[:split_index]
    val_pairs = pairs[split_index:]
    if not train_pairs or not val_pairs:
        raise ValueError("The requested ratio does not produce non-empty train and validation splits.")

    prepare_output(args.output, (args.images, args.labels), args.overwrite)
    copy_pairs(train_pairs, args.output, "train")
    copy_pairs(val_pairs, args.output, "val")

    print(f"Matched pairs: {len(pairs)}")
    print(f"Train pairs: {len(train_pairs)}")
    print(f"Validation pairs: {len(val_pairs)}")
    print(f"Prepared dataset: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
