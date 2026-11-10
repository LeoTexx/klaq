// Face boxes for a folder of frames, with Apple Vision (macOS, no dependencies).
//
//   swift head.swift <dir-of-jpgs>   → prints JSON: [[x, y, w, h, confidence] | null, …] in file-name order
//
// Coordinates are normalised to the frame, origin top-left (Vision's origin is bottom-left).
// When several faces are found, the largest one wins (the speaker is the closest face).
import Foundation
import Vision
import AppKit

let dir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "."
let files = (try? FileManager.default.contentsOfDirectory(atPath: dir))?.filter { $0.hasSuffix(".jpg") }.sorted() ?? []
var out: [String] = []
for name in files {
  let url = URL(fileURLWithPath: dir).appendingPathComponent(name)
  guard let img = NSImage(contentsOf: url), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    out.append("null"); continue
  }
  let req = VNDetectFaceRectanglesRequest()
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  try? handler.perform([req])
  let faces = (req.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
  if let f = faces.first {
    let b = f.boundingBox
    out.append(String(format: "[%.4f,%.4f,%.4f,%.4f,%.3f]", b.minX, 1 - b.maxY, b.width, b.height, f.confidence))
  } else {
    out.append("null")
  }
}
print("[" + out.joined(separator: ",") + "]")
