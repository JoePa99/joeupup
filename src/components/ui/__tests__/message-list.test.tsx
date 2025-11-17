import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../message-list';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { full_name: 'Test User' }
    }
  })
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {}
}));

describe('MessageList citations', () => {
  const baseMessage = {
    id: 'assistant-1',
    role: 'assistant' as const,
    content: 'Here are the details you requested.',
    created_at: new Date().toISOString(),
    content_type: 'text' as const,
  };

  it('renders Company OS and Knowledge Base context with links', () => {
    const messages = [
      {
        ...baseMessage,
        content_metadata: {
          context_used: true,
          citations: [
            {
              id: 'os-1',
              tier: 'companyOS',
              content: 'Mission: Serve customers with care.',
              metadata: { source: 'CompanyOS', url: 'https://company.os/doc' }
            },
            {
              id: 'kb-1',
              tier: 'agentDocs',
              content: 'KB: How to reset a password.',
              metadata: { source: 'Scoped KB', url: 'https://kb.local/doc' }
            }
          ]
        }
      }
    ];

    render(
      <MessageList
        messages={messages as any}
        isLoading={false}
        agent={{ id: 'agent-1', name: 'Support Agent', description: '', role: 'assistant', nickname: null, avatar_url: null, status: 'active' }}
      />
    );

    expect(screen.getByText(/Context Sources/i)).toBeInTheDocument();
    expect(screen.getByText('Company OS')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: /View source/i });
    expect(links[0]).toHaveAttribute('href', 'https://company.os/doc');
    expect(links[1]).toHaveAttribute('href', 'https://kb.local/doc');
  });
});
