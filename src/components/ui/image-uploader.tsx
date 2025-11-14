import { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  variant?: "circular" | "square";
  size?: "sm" | "md" | "lg";
  label?: string;
  disabled?: boolean;
}

const sizeClasses = {
  sm: "w-20 h-20",
  md: "w-32 h-32",
  lg: "w-40 h-40",
};

export function ImageUploader({
  currentImageUrl,
  onUpload,
  onDelete,
  variant = "circular",
  size = "md",
  label,
  disabled = false,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFileSize = 2 * 1024 * 1024; // 2MB
  const acceptedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return "Please upload a PNG, JPEG, or WebP image.";
    }
    if (file.size > maxFileSize) {
      return "File size must be less than 2MB.";
    }
    return null;
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      alert(error);
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsUploading(true);

    try {
      await onUpload(file);
    } catch (error) {
      console.error("Upload error:", error);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsUploading(true);
    try {
      await onDelete();
      setPreviewUrl(null);
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      alert(error);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsUploading(true);

    try {
      await onUpload(file);
    } catch (error) {
      console.error("Upload error:", error);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const displayUrl = previewUrl || currentImageUrl;
  const hasImage = !!displayUrl;

  return (
    <div className="flex flex-col items-center space-y-4">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      <div
        className={cn(
          "relative group cursor-pointer transition-all duration-200",
          sizeClasses[size],
          variant === "circular" ? "rounded-full" : "rounded-xl",
          isDragging && "scale-105 ring-2 ring-primary ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Image or placeholder */}
        <div
          className={cn(
            "w-full h-full flex items-center justify-center border-2 border-dashed border-border bg-muted overflow-hidden transition-all",
            variant === "circular" ? "rounded-full" : "rounded-xl",
            hasImage && "border-solid border-transparent"
          )}
        >
          {hasImage ? (
            <img
              src={displayUrl}
              alt="Upload preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        {/* Hover overlay */}
        {!disabled && (
          <div
            className={cn(
              "absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200",
              variant === "circular" ? "rounded-full" : "rounded-xl"
            )}
          >
            <div className="text-center text-white">
              <Upload className="h-6 w-6 mx-auto mb-1" />
              <p className="text-xs font-medium">
                {hasImage ? "Change" : "Upload"}
              </p>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
          <div
            className={cn(
              "absolute inset-0 bg-black/70 flex items-center justify-center",
              variant === "circular" ? "rounded-full" : "rounded-xl"
            )}
          >
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </div>

      {/* Delete button */}
      {hasImage && onDelete && !isUploading && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4 mr-1" />
          Remove
        </Button>
      )}

      <p className="text-xs text-muted-foreground text-center">
        PNG, JPEG, or WebP (max 2MB)
      </p>
    </div>
  );
}

