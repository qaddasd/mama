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
  DrawModeAtom,
  ImageSentAtom,
  ImageSrcAtom,
  IsUploadedImageAtom,
  CameraStreamAtom, 
  DetectTypeAtom, 
  ShareStream, 
} from './atoms';
import {useResetState} from './hooks';
import {ScreenshareButton} from './ScreenshareButton';

export function SideControls() {
  const [, setImageSrc] = useAtom(ImageSrcAtom);
  const [drawMode, setDrawMode] = useAtom(DrawModeAtom);
  const [, setIsUploadedImage] = useAtom(IsUploadedImageAtom);
  const [, setImageSent] = useAtom(ImageSentAtom);
  const resetState = useResetState();
  const [, setCameraStream] = useAtom(CameraStreamAtom);
  const [, setDetectType] = useAtom(DetectTypeAtom);
  const [, setShareStream] = useAtom(ShareStream);


  const handleCameraClick = async () => {
    resetState(); 
    setImageSrc(null); 
    setShareStream(null); 

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      setDetectType('2D bounding boxes'); 
      setIsUploadedImage(false); 
      setImageSent(false);
    } catch (err) {
      console.error("Error accessing camera: ", err);
      alert("Could not access the camera. Please ensure permissions are granted and no other application is using it.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center button bg-[#3B68FF] px-12 !text-white !border-none">
        <input
          className="hidden"
          type="file"
          accept=".jpg, .jpeg, .png, .webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                resetState(); 
                setCameraStream(null); 
                setShareStream(null); 
                setImageSrc(ev.target?.result as string);
                setIsUploadedImage(true);
                setImageSent(false);
              };
              reader.readAsDataURL(file);
            }
          }}
        />
        <div>Upload an image</div>
      </label>
      <button
        className="button flex gap-3 justify-center items-center"
        onClick={handleCameraClick}>
        <div className="text-lg" aria-hidden="true">📸</div>
        <div>Live Camera</div>
      </button>
      <ScreenshareButton />
      <div className="hidden"> {/* Original Draw on image button - keeping structure */}
        <button
          className="button flex gap-3 justify-center items-center"
          onClick={() => {
            setDrawMode(!drawMode);
          }}>
          <div className="text-lg" aria-hidden="true"> 🎨</div>
          <div>Draw on image</div>
        </button>
      </div>
    </div>
  );
}