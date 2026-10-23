"""Train the BdSL YOLOv8s detector with the validated experiment defaults."""

from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune YOLOv8s on a BdSL YOLO dataset.")
    parser.add_argument("--data", type=Path, required=True, help="Ultralytics dataset YAML file.")
    parser.add_argument("--model", default="yolov8s.pt", help="Initial checkpoint (default: yolov8s.pt).")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=416)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--project", default="runs/train")
    parser.add_argument("--name", default="bdsl_yolov8s")
    parser.add_argument("--optimizer", default="AdamW")
    parser.add_argument("--lr0", type=float, default=0.01)
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--cache", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--save-period", type=int, default=10)
    parser.add_argument("--device", help="Ultralytics device selector, for example 0, cpu, or mps.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.data.is_file():
        raise FileNotFoundError(f"Dataset config does not exist: {args.data}")

    train_args = {
        "data": str(args.data),
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "project": args.project,
        "name": args.name,
        "optimizer": args.optimizer,
        "lr0": args.lr0,
        "patience": args.patience,
        "cache": args.cache,
        "workers": args.workers,
        "seed": args.seed,
        "save_period": args.save_period,
    }
    if args.device is not None:
        train_args["device"] = args.device

    YOLO(args.model).train(**train_args)


if __name__ == "__main__":
    main()
