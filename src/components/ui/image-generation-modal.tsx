import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ImageGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string;
  agentConfig?: {
    ai_provider?: string;
    ai_model?: string;
  };
  onImageGenerated?: (imageUrl: string, prompt: string) => void;
}

export function ImageGenerationModal({
  open,
  onOpenChange,
  agentId,
  agentConfig,
  onImageGenerated,
}: ImageGenerationModalProps) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState("1024x1024");
  const [quality, setQuality] = useState("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt required",
        description: "Please enter a description for the image you want to generate.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("openai-image-generation", {
        body: {
          prompt: prompt.trim(),
          size,
          quality,
          ai_provider: agentConfig?.ai_provider || "openai",
          ai_model: agentConfig?.ai_model || "gpt-image-1",
          optimize_prompt: true, // Enable prompt optimization
        },
      });

      if (error) throw error;

      if (data?.success && data?.images?.length > 0) {
        const imageUrl = data.images[0].url;
        toast({
          title: "Image generated!",
          description: "Your image has been created successfully.",
        });
        
        // Call the callback with the generated image
        if (onImageGenerated) {
          onImageGenerated(imageUrl, prompt);
        }
        
        // Reset and close
        setPrompt("");
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to generate image");
      }
    } catch (error) {
      console.error("Image generation error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const provider = agentConfig?.ai_provider || "openai";
  const model = agentConfig?.ai_model || "gpt-image-1";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate Image
          </DialogTitle>
          <DialogDescription>
            Using {provider === "lovable" ? "Lovable AI (Gemini)" : "OpenAI"} · {model}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">
              Image Description
              {provider === "lovable" && (
                <span className="text-xs text-muted-foreground ml-2">
                  (Tip: Gemini excels at detailed scene descriptions)
                </span>
              )}
            </Label>
            <Textarea
              id="prompt"
              placeholder={
                provider === "lovable"
                  ? "Describe the image with details about composition, lighting, mood, and style..."
                  : "Describe the image you want to generate..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Select value={size} onValueChange={setSize} disabled={isGenerating}>
                <SelectTrigger id="size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024x1024">1024×1024 (Square)</SelectItem>
                  <SelectItem value="1792x1024">1792×1024 (Landscape)</SelectItem>
                  <SelectItem value="1024x1792">1024×1792 (Portrait)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quality">Quality</Label>
              <Select value={quality} onValueChange={setQuality} disabled={isGenerating}>
                <SelectTrigger id="quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="hd">HD (Higher quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating || !prompt.trim()}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Image
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
