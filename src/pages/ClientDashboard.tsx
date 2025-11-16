import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { UnifiedChatArea } from "@/components/ui/unified-chat-area";
import { CreateChannelModal } from "@/components/modals/CreateChannelModal";
import { Button } from "@/components/ui/button";

export default function ClientDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const agentId = searchParams.get("agent");
  const channelId = searchParams.get("channel");
  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false);

  const showChatArea = Boolean(channelId || agentId);

  const handleChannelCreated = (id: string) => {
    setCreateChannelModalOpen(false);
    navigate(`/client-dashboard?channel=${id}`);
  };

  return (
    <div className="h-full bg-white flex flex-col">
      {showChatArea ? (
        <UnifiedChatArea agentId={agentId || undefined} channelId={channelId || undefined} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center px-4 space-y-4">
          <div className="space-y-2 max-w-lg">
            <h2 className="text-2xl font-semibold text-foreground">Choose a channel to get started</h2>
            <p className="text-muted-foreground">
              Pick an existing channel from the sidebar or create a new one to keep your team and assistants aligned.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="default" onClick={() => setCreateChannelModalOpen(true)}>
              Create Channel
            </Button>
            <Button variant="outline" onClick={() => navigate("/invite-team")}>Manage Members</Button>
          </div>
        </div>
      )}

      <CreateChannelModal
        isOpen={createChannelModalOpen}
        onClose={() => setCreateChannelModalOpen(false)}
        onChannelCreated={handleChannelCreated}
      />
    </div>
  );
}
