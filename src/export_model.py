"""Explicitly export a trained YOLO checkpoint for edge runtimes."""

from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export a trained YOLO .pt checkpoint to FP16.")
    parser.add_argument("checkpoint", type=Path, help="Trained .pt checkpoint.")
    parser.add_argument(
        "--format",
        dest="formats",
        action="append",
        choices=("tflite", "onnx"),
        required=True,
        help="Export target. Repeat to export both formats.",
    )
    parser.add_argument("--imgsz", type=int, default=416)
    parser.add_argument("--device", help="Ultralytics device selector.")
    parser.add_argument("--opset", type=int, help="Optional ONNX opset version.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.checkpoint.is_file() or args.checkpoint.suffix.lower() != ".pt":
        raise FileNotFoundError(f"Expected an existing .pt checkpoint: {args.checkpoint}")

    model = YOLO(str(args.checkpoint))
    for export_format in dict.fromkeys(args.formats):
        export_args: dict[str, object] = {
            "format": export_format,
            "half": True,
            "imgsz": args.imgsz,
        }
        if args.device is not None:
            export_args["device"] = args.device
        if export_format == "onnx" and args.opset is not None:
            export_args["opset"] = args.opset
        output = model.export(**export_args)
        print(f"Exported {export_format.upper()}: {output}")


if __name__ == "__main__":
    main()
