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
import {ShareStream, ImageSrcAtom, CameraStreamAtom, IsUploadedImageAtom, ImageSentAtom, DetectTypeAtom} from './atoms';
import {useResetState} from './hooks';

export function ScreenshareButton() {
  const [, setStream] = useAtom(ShareStream);
  const resetState = useResetState();
  const [, setImageSrc] = useAtom(ImageSrcAtom);
  const [, setCameraStream] = useAtom(CameraStreamAtom);
  const [, setIsUploadedImage] = useAtom(IsUploadedImageAtom);
  const [, setImageSent] = useAtom(ImageSentAtom);
  const [, setDetectType] = useAtom(DetectTypeAtom);

  return (
    <button
      className="button flex gap-3 justify-center items-center"
      onClick={() => {
        resetState(); 
        setImageSrc(null); 
        setCameraStream(null); 

        navigator.mediaDevices.getDisplayMedia({video: true}).then((streamData) => {
          setStream(streamData);
          setIsUploadedImage(false);
          setImageSent(false);
          // Optionally set a default detection type for screenshare
          // setDetectType('2D bounding boxes'); 
        }).catch(err => {
          console.error("Error starting screenshare: ", err);
          alert("Could not start screenshare. Please ensure permissions are granted.");
        });
      }}>
      <div className="text-lg" aria-hidden="true">🖥️</div>
      <div>Screenshare</div>
    </button>
  );
}