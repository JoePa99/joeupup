import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Download, Maximize2, Palette, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageData {
  url: string;
  revised_prompt?: string;
  storage_path?: string;
}

interface ImageGenerationMetadata {
  original_prompt: string;
  size: string;
  quality: string;
  model: string;
  generated_at: string;
  execution_time: number;
}

interface ImageGenerationCardProps {
  images: ImageData[];
  metadata: ImageGenerationMetadata;
}

export function ImageGenerationCard({ images, metadata }: ImageGenerationCardProps) {
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

  const handleDownload = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `generated-image-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Image Downloaded",
        description: `Image ${index + 1} has been saved to your downloads.`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Failed to download the image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatExecutionTime = (ms: number) => {
    return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (images.length === 0) {
    return (
      <Card className="border border-red-200 bg-red-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-red-600">
            <Palette className="h-4 w-4" />
            <span className="text-sm font-medium">Image generation failed</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none max-w-4xl">
      
      
      <CardContent className="space-y-4">
        {/* Image Grid */}
        <div className={`grid gap-4 ${images.length === 1 ? 'grid-cols-1 max-w-[400px]' : images.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {images.map((image, index) => (
            <div key={index} className="group relative">
              <div className="aspect-square rounded-lg overflow-hidden shadow-none transition-all duration-200 min-w-[400px] min-h-[400px]">
                <img
                  src={image.url}
                  alt={`Generated image ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                
                {/* Overlay with actions */}
                <div className="absolute inset-0 bg-black/0 rounded-lg group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-black w-8 p-0 bg-white/90 hover:bg-white"
                          onClick={() => setSelectedImage(image)}
                        >
                          <Maximize2 className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] p-2">
                        <div className="relative">
                          <img
                            src={selectedImage?.url || image.url}
                            alt={`Generated image ${index + 1} - Full size`}
                            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                          />
                          <div className="absolute bottom-4 right-2">
                            <Button
                              size="sm"
                              onClick={() => handleDownload(image.url, index)}
                              className="bg-white/90 hover:bg-white text-black "
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(image.url, index)}
                      className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-black"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Image metadata */}
              
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}