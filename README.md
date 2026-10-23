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

The best YOLOv8s checkpoint was evaluated on the 828-image validation split.

| Metric | Score |
|---|---:|
| Precision | 0.734 |
| Recall | 0.729 |
| mAP@0.50 | 0.639 |
| mAP@0.50:0.95 | 0.208 |

### Training Progress

![Validation mAP](results/training/map_progress.png)

![Training losses](results/training/training_losses.png)

### Per-Class Performance

![Per-class mAP50](results/per_class_map50.png)

Performance varied considerably across the 18 signs. Stronger classes included `অপেক্ষা করো`, `ভালো`, and `মাথাব্যথা`, while classes such as `ক্ষুধার্ত` and `দুঃখিত` remained more challenging.

Full class-level results are available in [`results/per_class_metrics.md`](results/per_class_metrics.md).


## Notebook

Training workflow: `notebooks/bdsl_vision_training.ipynb`

## Demo

Interactive browser demo coming soon.