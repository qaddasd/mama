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
  BumpSessionAtom,
  ImageSentAtom,
  PointsAtom,
  ShareStream,
  CameraStreamAtom, 
  LinesAtom, 
  ImageSrcAtom, 
} from './atoms';
// import { imageOptions } from './consts'; // Only if resetting to default image

export function useResetState() {
  const [, setImageSent] = useAtom(ImageSentAtom);
  const [, setBoundingBoxes2D] = useAtom(BoundingBoxes2DAtom);
  const [, setBoundingBoxes3D] = useAtom(BoundingBoxes3DAtom);
  const [, setBoundingBoxMasks] = useAtom(BoundingBoxMasksAtom);
  const [, setPoints] = useAtom(PointsAtom);
  const [, setBumpSession] = useAtom(BumpSessionAtom);
  const [, setShareStream] = useAtom(ShareStream);
  const [, setCameraStream] = useAtom(CameraStreamAtom);
  const [, setLines] = useAtom(LinesAtom);
  const [, setImageSrc] = useAtom(ImageSrcAtom);


  return () => {
    setImageSent(false);
    setBoundingBoxes2D([]);
    setBoundingBoxes3D([]);
    setBoundingBoxMasks([]);
    setPoints([]);
    setLines([]); 

    setShareStream((prevStream) => {
      prevStream?.getTracks().forEach((track) => track.stop());
      return null;
    });
    setCameraStream((prevStream) => {
      prevStream?.getTracks().forEach((track) => track.stop());
      return null;
    });
    
    // setImageSrc(null); // Actions like selecting an example image, uploading, or starting a stream will set the new source.
                         // Keeping ImageSrcAtom as is during generic reset allows the app to return to its default image if no other action follows.
                         // Specific actions (like starting camera) will explicitly setImageSrc(null).

    setBumpSession((prev) => prev + 1); 
  };
}