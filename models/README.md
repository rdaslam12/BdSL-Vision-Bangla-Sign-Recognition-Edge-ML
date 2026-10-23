# Model Artifacts

Final artifacts from the BdSL Vision pipeline.

| Artifact | Format | Purpose | Included |
|---|---|---|---|
| `best.pt` | PyTorch | Best YOLOv8s training checkpoint | Yes |
| `best_float16.tflite` | TensorFlow Lite FP16 | Android / edge deployment | No — copy manually |
| `../demo/public/models/bdsl-yolov8s.onnx` | ONNX FP16 | Browser inference | Yes |

Model:

- YOLOv8s
- 18 BdSL word classes
- 416 × 416 input

These artifacts support recognition of the project's predefined vocabulary; they are not a complete Bangla Sign Language translation system.
