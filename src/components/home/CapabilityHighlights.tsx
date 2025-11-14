import { useState } from "react";
import { ChevronLeft, ChevronRight, Zap, Brain, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import heroImage from "@/assets/hero-image.jpg";

const highlights = [
  {
    title: "Automate Complex Tasks",
    description: "Deploy AI agents that handle customer service, data analysis, and operational workflows with human-level accuracy.",
    icon: Zap,
    features: ["24/7 availability", "Multi-channel support", "Real-time learning"],
    image: heroImage
  },
  {
    title: "Build Smart Playbooks",
    description: "Create comprehensive knowledge bases that your AI agents use to make informed decisions and maintain consistency.",
    icon: Brain,
    features: ["Version control", "Team collaboration", "Auto-updates"],
    image: heroImage
  },
  {
    title: "Enterprise Security",
    description: "Bank-grade security with role-based access control, audit logs, and compliance with GDPR and CCPA requirements.",
    icon: Shield,
    features: ["RBAC controls", "Audit trails", "Data encryption"],
    image: heroImage
  }
];

export function CapabilityHighlights() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % highlights.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + highlights.length) % highlights.length);
  };

  const currentHighlight = highlights[currentIndex];
  const Icon = currentHighlight.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-foreground">Platform Capabilities</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={prevSlide}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={nextSlide}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid lg:grid-cols-2 gap-0">
          {/* Content */}
          <div className="p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-lg bg-gradient-primary">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                {currentHighlight.title}
              </h3>
            </div>

            <p className="text-text-secondary leading-relaxed">
              {currentHighlight.description}
            </p>

            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Key Features:</h4>
              <ul className="space-y-2">
                {currentHighlight.features.map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm text-text-secondary">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button className="btn-hero">
              Learn More
            </Button>
          </div>

          {/* Image */}
          <div className="relative bg-muted lg:min-h-[400px]">
            <img 
              src={currentHighlight.image} 
              alt={currentHighlight.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
          </div>
        </div>
      </Card>

      {/* Dots indicator */}
      <div className="flex items-center justify-center space-x-2">
        {highlights.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-2 w-8 rounded-full transition-colors duration-200 ${
              index === currentIndex ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
}