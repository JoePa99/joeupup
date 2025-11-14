import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    companyName: "",
    rememberMe: false,
  });
  
  const { signIn, signUp, user, isOnboardingComplete } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users
  useEffect(() => {
    if (user && isOnboardingComplete === true) {
      navigate("/client-dashboard");
    } else if (user && isOnboardingComplete === false) {
      navigate("/onboarding");
    }
  }, [user, isOnboardingComplete, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!formData.companyName.trim()) {
          return;
        }
        const { error } = await signUp(formData.email, formData.password, formData.companyName);
        if (!error) {
          // Signup successful, navigate to onboarding immediately
          navigate('/onboarding');
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (!error) {
          // Login successful, user will be redirected by useEffect
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-2xl font-bold text-gradient">Variant</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-sm sm:text-base text-text-secondary">
            {isSignUp 
              ? "Start building with AI agents today" 
              : "Sign in to your Variant dashboard"
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="company" 
                  placeholder="Acme Corp" 
                  className="pl-10"
                  value={formData.companyName}
                  onChange={(e) => updateFormData("companyName", e.target.value)}
                  required 
                />
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="email" 
                type="email" 
                placeholder="you@company.com" 
                className="pl-10"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"}
                placeholder="••••••••" 
                className="pl-10 pr-10"
                value={formData.password}
                onChange={(e) => updateFormData("password", e.target.value)}
                required 
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {!isSignUp && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={formData.rememberMe}
                  onCheckedChange={(checked) => updateFormData("rememberMe", checked)}
                />
                <Label htmlFor="remember" className="text-sm">Remember me</Label>
              </div>
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
          )}

          <Button type="submit" className="w-full btn-hero" disabled={loading}>
            {loading ? "Please wait..." : (isSignUp ? "Create Account" : "Sign In")}
          </Button>
        </form>


        <div className="text-center text-sm">
          <span className="text-text-secondary">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
          </span>{" "}
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-primary hover:underline font-medium"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </div>

        <div className="text-center space-x-4 text-xs text-text-secondary">
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/terms" className="hover:underline">Terms of Service</Link>
        </div>
      </Card>
    </div>
  );
}