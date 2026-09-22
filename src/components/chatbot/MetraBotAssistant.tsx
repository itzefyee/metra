'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ChatLauncher from './ChatLauncher';
import ChatPanel from './ChatPanel';
import ChatConversation, { ConversationEntry } from './ChatConversation';
import { CHAT_THEMES, ChatThemeId } from './chat-themes';

const STORAGE_KEY = 'metra-bot-history';
// Read the former browser-only key once so existing conversations copy forward.
const LEGACY_STORAGE_KEY = ['metal', 'bot-history'].join('');

const MetraBotAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<ChatThemeId>('account');
  
  const [history, setHistory] = useState<ConversationEntry[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored =
        window.localStorage.getItem(STORAGE_KEY) ??
        window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const activeTheme = useMemo(
    () => CHAT_THEMES.find((theme) => theme.id === activeThemeId) ?? CHAT_THEMES[0],
    [activeThemeId]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && history.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  }, [history]);

  return (
    <>
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        theme={activeTheme}
        activeThemeId={activeThemeId}
        onSelectTheme={setActiveThemeId}
      >
        <ChatConversation history={history} onHistoryChange={setHistory} />
      </ChatPanel>

      <ChatLauncher isOpen={isOpen} onToggle={() => setIsOpen((prev) => !prev)} theme={activeTheme} />
    </>
  );
};

export default MetraBotAssistant;
