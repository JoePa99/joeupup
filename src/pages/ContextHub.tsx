import { Link } from "react-router-dom";
import {
  ShieldCheckIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ContextHub = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="w-fit">Admins only</Badge>
          <h1 className="text-3xl font-semibold text-foreground">Context Hub</h1>
          <p className="text-muted-foreground">
            Centralize your company context so agents and channels always have the latest knowledge.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="secondary">
            <Link to="/documents">Review documents</Link>
          </Button>
          <Button asChild>
            <Link to="/company-agents">Manage agents</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheckIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Guarded for admins</CardTitle>
                <CardDescription>Only company administrators can access the Context Hub.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Use the hub to curate the knowledge that powers your agents. Add context, upload critical documents,
              and keep your company data aligned.
            </p>
            <p className="rounded-md border bg-muted/30 p-3 text-foreground">
              Tip: Pair new context with an agent update so teams know when fresh guidance is available.
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <SparklesIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Quick next steps</CardTitle>
                <CardDescription>Keep your workspace tidy and ready for your team.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3 rounded-md border p-3">
              <CloudArrowUpIcon className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Upload or refresh key context</p>
                <p>Make sure your core documents live in one place before sharing with the team.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/documents">
                  Go to documents
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-3 rounded-md border p-3">
              <ShieldCheckIcon className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Assign the right owners</p>
                <p>Keep the hub current by ensuring admins and agents know who manages each area.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/company-agents">
                  Manage admins
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContextHub;
