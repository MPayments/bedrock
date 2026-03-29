"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@bedrock/sdk-ui/components/dialog";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Loader2 } from "lucide-react";

// Fixed dimensions for A4 document compatibility (display size in docx)
export const IMAGE_DIMENSIONS = {
  signature: { width: 150, height: 50, aspect: 3 }, // 3:1 ratio
  seal: { width: 200, height: 200, aspect: 1 }, // 1:1 ratio (square)
} as const;

// Scale factor for high-quality output — the actual PNG will contain
// SCALE × more pixels than the display dimensions, preventing pixelation
// when rendered in documents / printed on paper.
const CROP_SCALE_FACTOR = 3;

export type ImageType = keyof typeof IMAGE_DIMENSIONS;

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  imageType: ImageType;
  onCropComplete: (croppedBlob: Blob, previewUrl: string) => void;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageCropper({
  open,
  onOpenChange,
  imageSrc,
  imageType,
  onCropComplete,
}: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  // Store the final pixel crop from onComplete for accurate cropping
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [processing, setProcessing] = useState(false);

  const {
    width: targetWidth,
    height: targetHeight,
    aspect,
  } = IMAGE_DIMENSIONS[imageType];

  // Reset crop when dialog opens or image changes
  useEffect(() => {
    if (open) {
      setCrop(undefined);
      setCompletedCrop(null);
    }
  }, [open, imageSrc]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      // Must use naturalWidth/naturalHeight for proper crop calculation
      const { naturalWidth, naturalHeight } = e.currentTarget;
      setCrop(centerAspectCrop(naturalWidth, naturalHeight, aspect));
    },
    [aspect]
  );

  const getCroppedImage = useCallback(async (): Promise<Blob | null> => {
    const image = imgRef.current;
    // Use completedCrop (pixel values) for accurate cropping
    if (!image || !completedCrop) return null;

    const canvas = document.createElement("canvas");

    // Render at SCALE× resolution for crisp output in documents/print.
    // The display size in the docx is still targetWidth × targetHeight,
    // but the actual pixel data is much richer.
    canvas.width = targetWidth * CROP_SCALE_FACTOR;
    canvas.height = targetHeight * CROP_SCALE_FACTOR;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // completedCrop is in PIXEL values relative to the DISPLAYED image
    // We need to scale to natural image dimensions
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Calculate source coordinates in natural image pixels
    const sourceX = completedCrop.x * scaleX;
    const sourceY = completedCrop.y * scaleY;
    const sourceWidth = completedCrop.width * scaleX;
    const sourceHeight = completedCrop.height * scaleY;

    // Draw the cropped image scaled to high-resolution canvas
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 1.0);
    });
  }, [completedCrop, targetWidth, targetHeight]);

  const handleSave = async () => {
    setProcessing(true);
    try {
      const blob = await getCroppedImage();
      if (blob) {
        const previewUrl = URL.createObjectURL(blob);
        onCropComplete(blob, previewUrl);
        onOpenChange(false);
      }
    } finally {
      setProcessing(false);
    }
  };

  const title =
    imageType === "signature" ? "Обрезка подписи" : "Обрезка печати";
  const description =
    imageType === "signature"
      ? `Выберите область с подписью. Результат: ${targetWidth}×${targetHeight}px (3:1)`
      : `Выберите область с печатью. Результат: ${targetWidth}×${targetHeight}px (1:1)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </DialogHeader>

        <div className="flex justify-center bg-muted/30 rounded-lg p-4 max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
            aspect={aspect}
            className="max-w-full"
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop preview"
              onLoad={onImageLoad}
              className="max-w-full max-h-[50vh] object-contain"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={processing}
          >
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={processing || !completedCrop}>
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Обработка...
              </>
            ) : (
              "Сохранить"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
