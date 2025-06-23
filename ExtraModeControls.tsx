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
import {
  BoundingBoxes2DAtom,
  BoundingBoxes3DAtom,
  BoundingBoxMasksAtom,
  DetectTypeAtom,
  DrawModeAtom,
  FOVAtom,
  LinesAtom,
  PointsAtom,
  ShareStream,
  CameraStreamAtom, 
  ActiveColorAtom, 
} from './atoms';
import {Palette} from './Palette';

export function ExtraModeControls() {
  const [, setBoundingBoxes2D] = useAtom(BoundingBoxes2DAtom);
  const [, setBoundingBoxes3D] = useAtom(BoundingBoxes3DAtom);
  const [, setBoundingBoxMasks] = useAtom(BoundingBoxMasksAtom);
  const [stream, setStream] = useAtom(ShareStream);
  const [cameraStream, setCameraStream] = useAtom(CameraStreamAtom); 
  const [detectType] = useAtom(DetectTypeAtom);
  const [fov, setFoV] = useAtom(FOVAtom);
  const [, setPoints] = useAtom(PointsAtom);
  const [drawMode, setDrawMode] = useAtom(DrawModeAtom);
  const [, setLines] = useAtom(LinesAtom);

  const showStreamControls = stream || cameraStream;
  // Show extra bar if stream controls are needed, or if 3D boxes are selected (for FOV), or if draw mode is active.
  const showExtraBar = showStreamControls || detectType === '3D bounding boxes' || drawMode;


  const stopMediaStream = (type: 'camera' | 'screenshare') => {
    if (type === 'camera' && cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    } else if (type === 'screenshare' && stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setBoundingBoxes2D([]);
    setBoundingBoxes3D([]);
    setBoundingBoxMasks([]);
    setPoints([]);
  };


  return (
    <>
      {detectType === '3D bounding boxes' ? (
        <div className="flex gap-3 px-3 py-3 items-center justify-center bg-[var(--accent-color)] text-[var(--bg-color)] text-center border-t" role="alert">
          <div className="text-lg" aria-hidden="true">🚧</div> 3D bounding boxes is a preliminary
          model capability. Use 2D bounding boxes for higher accuracy.
        </div>
      ) : null}
      {drawMode ? (
        <div className="flex gap-3 px-3 py-3 items-center justify-between border-t">
          <div style={{width: 200}} aria-hidden="true"></div> {/* Spacer */}
          <div className="grow flex justify-center">
            <Palette />
          </div>
          <div className="flex gap-3">
            <button
              className="flex gap-3 text-sm secondary"
              onClick={() => {
                setLines([]);
              }}
              aria-label="Clear drawings">
              <div className="text-xs" aria-hidden="true">🗑️</div>
              Clear
            </button>
            <button
              className="flex gap-3 secondary"
              onClick={() => {
                setDrawMode(false);
              }}
              aria-label="Done drawing">
              <div className="text-sm" aria-hidden="true">✅</div>
              <div>Done</div>
            </button>
          </div>
        </div>
      ) : null}
      {/* Conditionally render the stream/FOV controls bar only if not in draw mode to avoid UI overlap */}
      {!drawMode && (showStreamControls || detectType === '3D bounding boxes') ? (
        <div className="flex gap-3 px-3 py-3 border-t items-center justify-center flex-wrap">
          {cameraStream ? (
            <button
              className="flex gap-3 text-sm items-center secondary"
              onClick={() => stopMediaStream('camera')}
              aria-label="Stop camera stream">
              <div className="text-xs" aria-hidden="true">📸</div>
              <div className="whitespace-nowrap">Stop Camera</div>
            </button>
          ) : null}
          {stream && !cameraStream ? ( 
            <button
              className="flex gap-3 text-sm items-center secondary"
              onClick={() => stopMediaStream('screenshare')}
              aria-label="Stop screenshare stream">
              <div className="text-xs" aria-hidden="true">🔴</div>
              <div className="whitespace-nowrap">Stop screenshare</div>
            </button>
          ) : null}
          {detectType === '3D bounding boxes' ? (
            <>
              <label htmlFor="fov-slider" id="fov-label" className="flex-shrink-0 ml-4">FOV:</label>
              <input
                id="fov-slider"
                className="w-full max-w-xs"
                type="range"
                min="30"
                max="120"
                value={fov}
                onChange={(e) => setFoV(+e.target.value)}
                aria-labelledby="fov-label"
              />
              <span className="flex-shrink-0 w-8 text-center" aria-live="polite">{fov}</span>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}