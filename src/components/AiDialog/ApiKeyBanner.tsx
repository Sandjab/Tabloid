import { useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, KeyRound, X } from 'lucide-react';

export default function ApiKeyBanner() {
  const { hasKey, setKey, clearKey } = useApiKey();
  const [draft, setDraft] = useState('');

  if (hasKey) {
    return (
      <div
        className="flex items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
        data-testid="api-key-banner-configured"
      >
        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />
          <span className="font-medium">Anthropic API key configured</span>
        </div>
        <Button
          size="xs"
          variant="ghost"
          onClick={clearKey}
          data-testid="api-key-forget-btn"
        >
          <X className="mr-1 size-3.5" /> Forget key
        </Button>
      </div>
    );
  }

  const handleSubmit = () => {
    if (!draft.trim()) return;
    setKey(draft);
    setDraft('');
  };

  return (
    <div
      className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm"
      data-testid="api-key-banner-missing"
    >
      <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
        <KeyRound className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium">Anthropic API key required</p>
          <p className="text-xs text-muted-foreground">
            Your key is stored in this browser's localStorage only. Tabloid has no servers — requests go
            straight from your browser to <code>api.anthropic.com</code>. Any script running on this origin
            could read the key; use a key with a spending limit.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="sk-ant-..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          data-testid="api-key-input"
        />
        <Button
          onClick={handleSubmit}
          disabled={!draft.trim()}
          data-testid="api-key-save-btn"
        >
          Save
        </Button>
      </div>
    </div>
  );
}
