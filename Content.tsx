/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */
// Copyright 2024 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {useAtom} from 'jotai';
import getStroke from 'perfect-freehand';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ResizePayload, useResizeDetector} from 'react-resize-detector';
import {
  ActiveColorAtom,
  BoundingBoxes2DAtom,
  BoundingBoxes3DAtom,
  BoundingBoxMasksAtom,
  DetectTypeAtom,
  DrawModeAtom,
  FOVAtom,
  ImageSentAtom,
  ImageSrcAtom,
  LinesAtom,
  PointsAtom,
  RevealOnHoverModeAtom,
  ShareStream,
  VideoRefAtom,
  CameraStreamAtom, 
} from './atoms';
import {lineOptions, segmentationColorsRgb} from './consts';
import {getSvgPathFromStroke} from './utils';

export function Content() {
  const [imageSrc] = useAtom(ImageSrcAtom);
  const [boundingBoxes2D] = useAtom(BoundingBoxes2DAtom);
  const [boundingBoxes3D] = useAtom(BoundingBoxes3DAtom);
  const [boundingBoxMasks] = useAtom(BoundingBoxMasksAtom);
  const [shareStream] = useAtom(ShareStream);
  const [cameraStream] = useAtom(CameraStreamAtom); 
  const [detectType] = useAtom(DetectTypeAtom);
  const [videoRef] = useAtom(VideoRefAtom);
  const [fov] = useAtom(FOVAtom);
  const [, setImageSent] = useAtom(ImageSentAtom);
  const [points] = useAtom(PointsAtom);
  const [revealOnHover] = useAtom(RevealOnHoverModeAtom);
  const [hoverEntered, setHoverEntered] = useState(false);
  const [hoveredBox, _setHoveredBox] = useState<number | null>(null);
  const [drawMode] = useAtom(DrawModeAtom);
  const [lines, setLines] = useAtom(LinesAtom);
  const [activeColor] = useAtom(ActiveColorAtom);

  const activeStream = cameraStream || shareStream; 

  const boundingBoxContainerRef = useRef<HTMLDivElement | null>(null);
  const [containerDims, setContainerDims] = useState({
    width: 0,
    height: 0,
  });
  const [activeMediaDimensions, setActiveMediaDimensions] = useState({
    width: 1, // Start with 1 to avoid division by zero if media loads late
    height: 1,
  });

  const onResize = useCallback((width?: number, height?: number) => { // Updated signature for react-resize-detector v12
    if (width && height) {
      setContainerDims({
        width,
        height,
      });
    }
  }, []);
  
  // Use new ResizePayload type if available, otherwise use width/height directly.
  // For older versions or direct usage:
  // const { ref: containerRef } = useResizeDetector({ onResize: (payload: ResizePayload) => onResize(payload.width, payload.height) });
  // For v12, it might be simpler:
   const { ref: containerRef } = useResizeDetector({ onResize });


  const boundingBoxContainer = useMemo(() => {
    const {width: mediaWidth, height: mediaHeight} = activeMediaDimensions;
    if (mediaWidth <= 0 || mediaHeight <= 0 || containerDims.width <= 0 || containerDims.height <= 0) {
        return { width: 0, height: 0 }; // Default or ensure it doesn't render
    }
    const mediaAspectRatio = mediaWidth / mediaHeight;
    const containerAspectRatio = containerDims.width / containerDims.height;

    if (mediaAspectRatio < containerAspectRatio) {
      return {
        height: containerDims.height,
        width: containerDims.height * mediaAspectRatio,
      };
    } else {
      return {
        width: containerDims.width,
        height: containerDims.width / mediaAspectRatio,
      };
    }
  }, [containerDims, activeMediaDimensions]);

  function matrixMultiply(m: number[][], v: number[]): number[] {
    return m.map((row: number[]) =>
      row.reduce((sum, val, i) => sum + val * v[i], 0),
    );
  }

  const linesAndLabels3D = useMemo(() => {
    if (!boundingBoxContainer || boundingBoxContainer.width === 0 || boundingBoxContainer.height === 0) { 
      return null;
    }
    let allLines = [];
    let allLabels = [];
    for (const box of boundingBoxes3D) {
      const {center, size, rpy} = box;
      const [sr, sp, sy] = rpy.map((x) => Math.sin(x / 2));
      const [cr, cp, cz] = rpy.map((x) => Math.cos(x / 2));
      const quaternion = [
        sr * cp * cz - cr * sp * sy,
        cr * sp * cz + sr * cp * sy,
        cr * cp * sy - sr * sp * cz,
        cr * cp * cz + sr * sp * sy,
      ];
      const height = boundingBoxContainer.height;
      const width = boundingBoxContainer.width;
      const f = width / (2 * Math.tan(((fov / 2) * Math.PI) / 180));
      const cx = width / 2;
      const cy = height / 2;
      const intrinsics = [[f, 0, cx], [0, f, cy], [0, 0, 1]];
      const halfSize = size.map((s) => s / 2);
      let corners = [];
      for (let x of [-halfSize[0], halfSize[0]]) {
        for (let y of [-halfSize[1], halfSize[1]]) {
          for (let z of [-halfSize[2], halfSize[2]]) {
            corners.push([x, y, z]);
          }
        }
      }
      corners = [corners[1], corners[3], corners[7], corners[5], corners[0], corners[2], corners[6], corners[4]];
      const q = quaternion;
      const rotationMatrix = [
        [1 - 2 * q[1] ** 2 - 2 * q[2] ** 2, 2 * q[0] * q[1] - 2 * q[3] * q[2], 2 * q[0] * q[2] + 2 * q[3] * q[1]],
        [2 * q[0] * q[1] + 2 * q[3] * q[2], 1 - 2 * q[0] ** 2 - 2 * q[2] ** 2, 2 * q[1] * q[2] - 2 * q[3] * q[0]],
        [2 * q[0] * q[2] - 2 * q[3] * q[1], 2 * q[1] * q[2] + 2 * q[3] * q[0], 1 - 2 * q[0] ** 2 - 2 * q[1] ** 2],
      ];
      const boxVertices = corners.map((corner) => {
        const rotated = matrixMultiply(rotationMatrix, corner);
        return rotated.map((val, idx) => val + center[idx]);
      });
      const tiltAngle = 90.0;
      const viewRotationMatrix = [
        [1, 0, 0],
        [0, Math.cos((tiltAngle * Math.PI) / 180), -Math.sin((tiltAngle * Math.PI) / 180)],
        [0, Math.sin((tiltAngle * Math.PI) / 180), Math.cos((tiltAngle * Math.PI) / 180)],
      ];
      const points3D = boxVertices; // Renamed to avoid conflict
      const rotatedPoints = points3D.map((p) => matrixMultiply(viewRotationMatrix, p));
      const translatedPoints = rotatedPoints.map((p) => p.map((v) => v + 0));
      const projectedPoints = translatedPoints.map((p) => matrixMultiply(intrinsics, p));
      const vertices = projectedPoints.map((p) => [p[0] / p[2], p[1] / p[2]]);
      const topVertices = vertices.slice(0, 4);
      const bottomVertices = vertices.slice(4, 8);
      for (let i = 0; i < 4; i++) {
        const linesData = [
          [topVertices[i], topVertices[(i + 1) % 4]],
          [bottomVertices[i], bottomVertices[(i + 1) % 4]],
          [topVertices[i], bottomVertices[i]],
        ];
        for (let [start, end] of linesData) {
          const dx = end[0] - start[0];
          const dy = end[1] - start[1];
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          allLines.push({start, end, length, angle});
        }
      }
      const textPosition3d = points3D[0].map((_, idx) => points3D.reduce((sum, p) => sum + p[idx], 0) / points3D.length);
      textPosition3d[2] += 0.1;
      const textPoint = matrixMultiply(intrinsics, matrixMultiply(viewRotationMatrix, textPosition3d.map((v) => v + 0)));
      const textPos = [textPoint[0] / textPoint[2], textPoint[1] / textPoint[2]];
      allLabels.push({label: box.label, pos: textPos});
    }
    return [allLines, allLabels] as const;
  }, [boundingBoxes3D, boundingBoxContainer, fov]);

  function setHoveredBox(e: React.PointerEvent) {
    const boxes = document.querySelectorAll('.bbox');
    const dimensionsAndIndex = Array.from(boxes).map((box, i) => {
      const {top, left, width, height} = box.getBoundingClientRect();
      return { top, left, width, height, index: i };
    });
    const sorted = dimensionsAndIndex.sort((a, b) => a.width * a.height - b.width * b.height);
    const {clientX, clientY} = e;
    const found = sorted.find(({top, left, width, height}) => 
        clientX > left && clientX < left + width && clientY > top && clientY < top + height);
    _setHoveredBox(found ? found.index : null);
  }

  const downRef = useRef<Boolean>(false);

  useEffect(() => {
    if (!activeStream && !imageSrc) {
      setActiveMediaDimensions({ width: 1, height: 1 }); // Reset to prevent stale aspect ratio
    }
  }, [activeStream, imageSrc]);

  return (
    <div ref={containerRef} className="w-full grow relative bg-black/10 dark:bg-white/5 flex items-center justify-center">
      {activeStream ? (
        <video
          className="absolute top-0 left-0 w-full h-full object-contain"
          autoPlay
          playsInline
          muted
          onLoadedMetadata={(e) => {
            setActiveMediaDimensions({
              width: e.currentTarget.videoWidth,
              height: e.currentTarget.videoHeight,
            });
          }}
          ref={(video) => {
            videoRef.current = video;
            if (video && activeStream) {
              if (video.srcObject !== activeStream) {
                 video.srcObject = activeStream;
              }
            } else if (video) { // No active stream, clear srcObject
              video.srcObject = null;
            }
          }}
          key={activeStream.id} // Force re-render if stream object itself changes
        />
      ) : imageSrc ? (
        <img
          src={imageSrc}
          className="absolute top-0 left-0 w-full h-full object-contain"
          alt="Uploaded content"
          onLoad={(e) => {
            setActiveMediaDimensions({
              width: e.currentTarget.naturalWidth,
              height: e.currentTarget.naturalHeight,
            });
          }}
        />
      ) : (
         <div className="text-[var(--text-color-secondary)] p-4 text-center">
            Please upload an image, share your screen, or start the live camera.
        </div>
      )}
      {(activeStream || imageSrc) && boundingBoxContainer.width > 0 && boundingBoxContainer.height > 0 && (
          <div
            className={`absolute w-full h-full left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 ${hoverEntered ? 'hide-box' : ''} ${drawMode ? 'cursor-crosshair' : ''}`}
            ref={boundingBoxContainerRef}
            onPointerEnter={(e) => {
            if (revealOnHover && !drawMode) {
                setHoverEntered(true);
                setHoveredBox(e);
            }
            }}
            onPointerMove={(e) => {
            if (revealOnHover && !drawMode) {
                setHoverEntered(true);
                setHoveredBox(e);
            }
            if (downRef.current && boundingBoxContainerRef.current && boundingBoxContainer.width > 0 && boundingBoxContainer.height > 0) {
                const parentBounds = boundingBoxContainerRef.current!.getBoundingClientRect();
                setLines((prev) => [
                ...prev.slice(0, prev.length - 1),
                [
                    [
                    ...prev[prev.length - 1][0],
                    [
                        (e.clientX - parentBounds.left) / boundingBoxContainer.width,
                        (e.clientY - parentBounds.top) / boundingBoxContainer.height,
                    ],
                    ],
                    prev[prev.length - 1][1],
                ],
                ]);
            }
            }}
            onPointerLeave={(e) => {
            if (revealOnHover && !drawMode) {
                setHoverEntered(false);
                setHoveredBox(e);
            }
            }}
            onPointerDown={(e) => {
            if (drawMode && boundingBoxContainerRef.current && boundingBoxContainer.width > 0 && boundingBoxContainer.height > 0) {
                setImageSent(false);
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                downRef.current = true;
                const parentBounds = boundingBoxContainerRef.current!.getBoundingClientRect();
                setLines((prev) => [
                ...prev,
                [
                    [
                    [
                        (e.clientX - parentBounds.left) / boundingBoxContainer.width,
                        (e.clientY - parentBounds.top) / boundingBoxContainer.height,
                    ],
                    ],
                    activeColor,
                ],
                ]);
            }
            }}
            onPointerUp={(e) => {
            if (drawMode) {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                downRef.current = false;
            }
            }}
            style={{
            width: boundingBoxContainer.width,
            height: boundingBoxContainer.height,
            }}>
            {lines.length > 0 && (
            <svg
                className="absolute top-0 left-0 w-full h-full"
                style={{
                pointerEvents: 'none',
                width: boundingBoxContainer.width,
                height: boundingBoxContainer.height,
                }}>
                {lines.map(([pointsArr, color], i) => ( // Renamed 'points' to 'pointsArr'
                <path
                    key={i}
                    d={getSvgPathFromStroke(
                    getStroke(
                        pointsArr.map(([x, y]) => [
                        x * boundingBoxContainer.width,
                        y * boundingBoxContainer.height,
                        0.5,
                        ]),
                        lineOptions,
                    ),
                    )}
                    fill={color}
                />
                ))}
            </svg>
            )}
            {detectType === '2D bounding boxes' &&
            boundingBoxes2D.map((box, i) => (
                <div
                key={i}
                className={`absolute bbox border-2 border-[#3B68FF] ${i === hoveredBox ? 'reveal' : ''}`}
                style={{
                    transformOrigin: '0 0',
                    top: box.y * 100 + '%',
                    left: box.x * 100 + '%',
                    width: box.width * 100 + '%',
                    height: box.height * 100 + '%',
                }}>
                <div className="bg-[#3B68FF] text-white absolute left-0 top-0 text-sm px-1">
                    {box.label}
                </div>
                </div>
            ))}
            {detectType === 'Segmentation masks' &&
            boundingBoxMasks.map((box, i) => (
                <div
                key={i}
                className={`absolute bbox border-2 border-[#3B68FF] ${i === hoveredBox ? 'reveal' : ''}`}
                style={{
                    transformOrigin: '0 0',
                    top: box.y * 100 + '%',
                    left: box.x * 100 + '%',
                    width: box.width * 100 + '%',
                    height: box.height * 100 + '%',
                }}>
                <BoxMask box={box} index={i} />
                <div className="w-full top-0 h-0 absolute">
                    <div className="bg-[#3B68FF] text-white absolute -left-[2px] bottom-0 text-sm px-1">
                    {box.label}
                    </div>
                </div>
                </div>
            ))}

            {detectType === 'Points' &&
            points.map((point, i) => {
                return (
                <div
                    key={i}
                    className="absolute" 
                    style={{
                    left: `${point.point.x * 100}%`,
                    top: `${point.point.y * 100}%`,
                    }}>
                    <div className="absolute bg-[#3B68FF] text-center text-white text-xs px-1 bottom-4 rounded-sm -translate-x-1/2 left-1/2 whitespace-nowrap">
                    {point.label}
                    </div>
                    <div className="absolute w-4 h-4 bg-[#3B68FF] rounded-full border-white border-[2px] -translate-x-1/2 -translate-y-1/2"></div>
                </div>
                );
            })}
            {detectType === '3D bounding boxes' && linesAndLabels3D ? (
            <>
                {linesAndLabels3D[0].map((line, i) => (
                <div
                    key={`3dline-${i}`}
                    className="absolute h-[2px] bg-[#3B68FF]"
                    style={{
                    width: `${line.length}px`,
                    transform: `translate(${line.start[0]}px, ${line.start[1]}px) rotate(${line.angle}rad)`,
                    transformOrigin: '0 0',
                    }}></div>
                ))}
                {linesAndLabels3D[1].map((label, i) => (
                <div
                    key={`3dlabel-${i}`}
                    className="absolute bg-[#3B68FF] text-white text-xs px-1"
                    style={{
                    top: `${label.pos[1]}px`,
                    left: `${label.pos[0]}px`,
                    transform: 'translate(-50%, -50%)',
                    }}>
                    {label.label}
                </div>
                ))}
            </>
            ) : null}
        </div>
      )}
    </div>
  );
}

function BoxMask({
  box,
  index,
}: {
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    imageData: string; // Expected to be base64 data URL for an image mask
  };
  index: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rgb = segmentationColorsRgb[index % segmentationColorsRgb.length];

  useEffect(() => {
    if (canvasRef.current && box.imageData) { // Ensure imageData exists
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const image = new Image();
        // Check if imageData is already a data URL, otherwise assume it might be path (though less likely for API)
        image.src = box.imageData.startsWith('data:image') ? box.imageData : `data:image/png;base64,${box.imageData}`;
        
        image.onload = () => {
          if (!canvasRef.current) return; 
          canvasRef.current.width = image.width;
          canvasRef.current.height = image.height;
          ctx.imageSmoothingEnabled = false; 
          ctx.drawImage(image, 0, 0);
          try {
            const pixels = ctx.getImageData(0, 0, image.width, image.height);
            const data = pixels.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i + 3] = data[i]; // Use one of the color channels (e.g., red) as alpha for the mask
              data[i] = rgb[0];
              data[i + 1] = rgb[1];
              data[i + 2] = rgb[2];
            }
            ctx.putImageData(pixels, 0, 0);
          } catch (e) {
            console.error("Error processing mask image data:", e);
            // This can happen due to tainted canvas if image source is cross-origin and not CORS-enabled
          }
        };
        image.onerror = () => {
          console.error("Failed to load mask image from data:", box.imageData.substring(0,100) + "...");
        }
      }
    }
  }, [canvasRef, box.imageData, rgb]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full"
      style={{opacity: 0.5}}
      aria-label={`Segmentation mask for ${box.label}`}
    />
  );
}