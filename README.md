# BdSL Vision

Bangla Sign Language recognition pipeline covering dataset preparation, annotation validation, YOLOv8 fine-tuning, evaluation, and edge deployment.

## Highlights

- 18 Bangla Sign Language word classes
- 4,139 annotated image-label pairs
- YOLOv8s fine-tuning
- Annotation validation and repair
- TensorFlow Lite export
- Android edge deployment

## Results

| Metric | Score |
|---|---:|
| Precision | 0.734 |
| Recall | 0.729 |
| mAP@0.50 | 0.639 |
| mAP@0.50:0.95 | 0.208 |

## Notebook

Training workflow: `notebooks/bdsl_vision_training.ipynb`

## Demo

Interactive browser demo coming soon.