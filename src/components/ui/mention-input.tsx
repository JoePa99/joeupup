import React from 'react';

export interface MentionUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  channelId?: string;
  onMention?: (mentionedUsers: MentionUser[]) => void;
  className?: string;
  disabled?: boolean;
}

const MentionInputComponent = ({
  value,
  onChange,
  placeholder = "Type your message...",
  className = "",
  disabled = false,
}: MentionInputProps) => {
  return (
    <div className={`relative ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full min-h-[40px] p-3 border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md"
      />
    </div>
  );
};

export default MentionInputComponent;