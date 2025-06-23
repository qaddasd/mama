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

import {GoogleGenAI, GenerateContentResponse, GenerateContentParameters} from '@google/genai';
import {useAtom} from 'jotai';
import getStroke from 'perfect-freehand';
import {useState} from 'react';
import {
  BoundingBoxMasksAtom,
  BoundingBoxes2DAtom,
  BoundingBoxes3DAtom,
  CustomPromptsAtom,
  DetectTypeAtom,
  HoverEnteredAtom,
  ImageSrcAtom,
  IsLoadingAtom,
  LinesAtom,
  PointsAtom,
  PromptsAtom,
  ShareStream,
  TemperatureAtom,
  VideoRefAtom,
  CameraStreamAtom,
} from './atoms';
import {lineOptions} from './consts';
import {getSvgPathFromStroke, loadImage} from './utils';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

export function Prompt() {
  const [temperature, setTemperature] = useAtom(TemperatureAtom);
  const [, setBoundingBoxes2D] = useAtom(BoundingBoxes2DAtom);
  const [, setBoundingBoxes3D] = useAtom(BoundingBoxes3DAtom);
  const [, setBoundingBoxMasks] = useAtom(BoundingBoxMasksAtom);
  const [shareStream] = useAtom(ShareStream);
  const [cameraStream] = useAtom(CameraStreamAtom);
  const [detectType] = useAtom(DetectTypeAtom);
  const [, setPoints] = useAtom(PointsAtom);
  const [, setHoverEntered] = useAtom(HoverEnteredAtom);
  const [lines] = useAtom(LinesAtom);
  const [videoRef] = useAtom(VideoRefAtom);
  const [imageSrc] = useAtom(ImageSrcAtom);
  const [showCustomPrompt] = useState(false);
  const [targetPrompt, setTargetPrompt] = useState('items');
  const [labelPrompt, setLabelPrompt] = useState('');
  const [showRawPrompt, setShowRawPrompt] = useState(false);

  const [prompts, setPrompts] = useAtom(PromptsAtom);
  const [customPrompts, setCustomPrompts] = useAtom(CustomPromptsAtom);
  const [isLoading, setIsLoading] = useAtom(IsLoadingAtom);

  const is2d = detectType === '2D bounding boxes';
  const activeStream = cameraStream || shareStream;

  const get2dPrompt = () =>
    `Detect ${targetPrompt}, with no more than 20 items. Output a json list where each entry contains the 2D bounding box in "box_2d" and ${
      labelPrompt || 'a text label'
    } in "label".`;

  async function handleSend() {
    if (!activeStream && !imageSrc && lines.length === 0) {
      console.warn("No content to send to API.");
      alert("Please provide an image, stream, or draw something to analyze.");
      return;
    }
    setIsLoading(true);
    try {
      let activeDataURL = '';
      const maxSize = 640;
      const copyCanvas = document.createElement('canvas');
      const ctx = copyCanvas.getContext('2d')!;

      if (activeStream) {
        const video = videoRef.current!;
        if (video && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
          const scale = Math.min(maxSize / video.videoWidth, maxSize / video.videoHeight, 1);
          copyCanvas.width = video.videoWidth * scale;
          copyCanvas.height = video.videoHeight * scale;
          ctx.drawImage(video, 0, 0, video.videoWidth * scale, video.videoHeight * scale);
          activeDataURL = copyCanvas.toDataURL('image/png');
        } else {
          console.error("Video stream not ready or video dimensions are zero.");
          alert("Video stream is not ready. Please try again.");
          setIsLoading(false);
          return;
        }
      } else if (imageSrc) {
        const image = await loadImage(imageSrc);
        if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            const scale = Math.min(maxSize / image.naturalWidth, maxSize / image.naturalHeight, 1);
            copyCanvas.width = image.naturalWidth * scale;
            copyCanvas.height = image.naturalHeight * scale;
            ctx.drawImage(image, 0, 0, image.naturalWidth * scale, image.naturalHeight * scale);
            activeDataURL = copyCanvas.toDataURL('image/png');
        } else {
            console.error("Image not loaded properly or dimensions are zero.");
            alert("Image could not be loaded. Please try a different image.");
            setIsLoading(false);
            return;
        }
      }

      if (lines.length > 0) {
        if (!activeDataURL) { // If drawing on a blank canvas (no image/stream yet)
            // Set a default size for the canvas if it's purely a drawing.
            // This might need to be based on the Content area's boundingBoxContainer dimensions.
            // For now, let's use a fallback or warn.
            // A better approach would be to get content area dimensions.
            // Assuming default if no other context:
            copyCanvas.width = copyCanvas.width || maxSize;
            copyCanvas.height = copyCanvas.height || maxSize * (9/16) ; // Default aspect ratio
            if (!activeDataURL) ctx.clearRect(0,0, copyCanvas.width, copyCanvas.height); // Clear if it was blank
            console.warn("Drawing on a canvas without a base image. Using default canvas size for drawing.")
        }

        if (copyCanvas.width === 0 || copyCanvas.height === 0) {
            console.error("Canvas for drawing lines is not initialized with valid dimensions.");
            alert("Cannot process drawing: canvas dimensions are invalid.");
            setIsLoading(false);
            return;
        }
        for (const line of lines) {
          const p = new Path2D(
            getSvgPathFromStroke(
              getStroke(
                line[0].map(([x, y]) => [
                  x * copyCanvas.width,
                  y * copyCanvas.height,
                  0.5,
                ]),
                lineOptions,
              ),
            ),
          );
          ctx.fillStyle = line[1];
          ctx.fill(p);
        }
        activeDataURL = copyCanvas.toDataURL('image/png');
      }

      if (!activeDataURL) {
        console.error("No image data could be prepared for sending.");
        alert("No image data available to send. Please select or provide an image/stream.");
        setIsLoading(false);
        return;
      }

      const currentPromptText = is2d ? get2dPrompt() : (showCustomPrompt ? customPrompts[detectType] : prompts[detectType].join(' '));
      setHoverEntered(false);

      const model = 'gemini-2.5-flash-preview-04-17';
      const genAIConfig: GenerateContentParameters['config'] = {
        temperature,
      };

      if (detectType === 'Segmentation masks') {
        genAIConfig.thinkingConfig = {thinkingBudget: 0};
      }

      const request: GenerateContentParameters = {
        model,
        contents: {
            parts: [
              {
                inlineData: {
                  data: activeDataURL.replace(/^data:image\/\w+;base64,/, ''),
                  mimeType: 'image/png',
                },
              },
              {text: currentPromptText},
            ]
        },
        config: genAIConfig,
      };

      const result: GenerateContentResponse = await ai.models.generateContent(request);
      let responseText = result.text; 

      // Improved JSON extraction
      if (typeof responseText === 'string') {
        const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
        const match = responseText.match(fenceRegex);
        if (match && match[1]) {
          responseText = match[1].trim();
        }
      } else {
        console.error("Unexpected API response format:", responseText);
        alert("Received an unexpected response format from the API.");
        setIsLoading(false);
        return;
      }

      const parsedResponse = JSON.parse(responseText);

      if (detectType === '2D bounding boxes') {
        const formattedBoxes = parsedResponse.map(
          (box: {box_2d: [number, number, number, number]; label: string}) => {
            const [ymin, xmin, ymax, xmax] = box.box_2d;
            return {
              x: xmin / 1000, y: ymin / 1000,
              width: (xmax - xmin) / 1000, height: (ymax - ymin) / 1000,
              label: box.label,
            };
          });
        setHoverEntered(false);
        setBoundingBoxes2D(formattedBoxes);
      } else if (detectType === 'Points') {
        const formattedPoints = parsedResponse.map(
          (point: {point: [number, number]; label: string}) => ({
              point: { x: point.point[1] / 1000, y: point.point[0] / 1000 },
              label: point.label,
          }));
        setPoints(formattedPoints);
      } else if (detectType === 'Segmentation masks') {
        const formattedBoxes = parsedResponse.map(
          (box: {box_2d: [number, number, number, number]; label: string; mask: string;}) => {
            const [ymin, xmin, ymax, xmax] = box.box_2d;
            return {
              x: xmin / 1000, y: ymin / 1000,
              width: (xmax - xmin) / 1000, height: (ymax - ymin) / 1000,
              label: box.label, imageData: box.mask,
            };
          });
        setHoverEntered(false);
        const sortedBoxes = formattedBoxes.sort((a: any, b: any) => b.width * b.height - a.width * a.height);
        setBoundingBoxMasks(sortedBoxes);
      } else { // 3D bounding boxes
        const formattedBoxes = parsedResponse.map(
          (box: {box_3d: [number,number,number,number,number,number,number,number,number]; label: string;}) => {
            const center = box.box_3d.slice(0, 3);
            const size = box.box_3d.slice(3, 6);
            const rpy = box.box_3d.slice(6).map((x: number) => (x * Math.PI) / 180);
            return { center, size, rpy, label: box.label };
          });
        setBoundingBoxes3D(formattedBoxes);
      }
    } catch (error: any) {
        console.error("Error in handleSend:", error);
        alert(`An error occurred: ${error.message || 'Failed to process request. Check console for details.'}`);
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex grow flex-col gap-3">
      <div className="flex justify-between items-center">
        <div className="uppercase">
          Prompt ({detectType === 'Segmentation masks'
            ? 'Gemini 2.5 Flash - thinking disabled'
            : 'Gemini 2.5 Flash'})
        </div>
        <label className="flex gap-2 select-none">
          <input
            type="checkbox"
            checked={showRawPrompt}
            onChange={() => setShowRawPrompt(!showRawPrompt)}
            disabled={isLoading}
            aria-label="Show raw prompt"
          />
          <div>show raw prompt</div>
        </label>
      </div>
      <div className="w-full flex flex-col">
        {showCustomPrompt ? (
          <textarea
            className="w-full bg-[var(--input-color)] rounded-lg resize-none p-4"
            value={customPrompts[detectType]}
            onChange={(e) => {
              const value = e.target.value;
              const newPrompts = {...customPrompts};
              newPrompts[detectType] = value;
              setCustomPrompts(newPrompts);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isLoading}
            aria-label="Custom prompt input"
            rows={3}
          />
        ) : showRawPrompt ? (
          <div className="mb-2 text-[var(--text-color-secondary)] p-2 border border-[var(--border-color)] rounded-md bg-[var(--input-color)] whitespace-pre-wrap text-xs">
            {is2d
              ? get2dPrompt()
              : prompts[detectType].join(detectType === 'Segmentation masks' ? '' : ' ')}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div>{prompts[detectType][0]}:</div>
            <textarea
              className="w-full bg-[var(--input-color)] rounded-lg resize-none p-4"
              placeholder="What kind of things do you want to detect?"
              rows={1}
              value={is2d ? targetPrompt : prompts[detectType][1]}
              onChange={(e) => {
                if (is2d) {
                  setTargetPrompt(e.target.value);
                } else {
                  const value = e.target.value;
                  const newPrompts = {...prompts};
                  newPrompts[detectType][1] = value;
                  setPrompts(newPrompts);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              aria-label="Target items for detection"
            />
            {is2d && (
              <>
                <div>Label each one with: (optional)</div>
                <textarea
                  className="w-full bg-[var(--input-color)] rounded-lg resize-none p-4"
                  rows={1}
                  placeholder="How do you want to label the things?"
                  value={labelPrompt}
                  onChange={(e) => setLabelPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isLoading}
                  aria-label="Labeling instructions for detected items"
                />
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-between gap-3 items-center">
        <button
          className={`bg-[#3B68FF] px-12 !text-white !border-none flex items-center justify-center ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleSend}
          disabled={isLoading}>
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                role="status"
                aria-hidden="true">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </>
          ) : (
            'Send'
          )}
        </button>
        <label className="flex items-center gap-2 cursor-pointer" htmlFor="temperature-slider">
          Temperature:
          <input
            id="temperature-slider"
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            disabled={isLoading}
            aria-label={`Temperature setting: ${temperature.toFixed(2)}`}
          />
          <span aria-live="polite">{temperature.toFixed(2)}</span>
        </label>
      </div>
    </div>
  );
}