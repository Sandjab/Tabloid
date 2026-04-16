import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ApiKeyBanner from './ApiKeyBanner';
import GenerateTab from './GenerateTab';
import SuggestFksTab from './SuggestFksTab';
import ExplainTab from './ExplainTab';
import InferTypesTab from './InferTypesTab';

interface AiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'generate' | 'suggest-fks' | 'explain' | 'infer-types';

const TABS: { value: Tab; label: string }[] = [
  { value: 'generate', label: 'Generate' },
  { value: 'suggest-fks', label: 'Suggest FKs' },
  { value: 'explain', label: 'Explain' },
  { value: 'infer-types', label: 'Infer types' },
];

export default function AiDialog({ open, onOpenChange }: AiDialogProps) {
  const [tab, setTab] = useState<Tab>('generate');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]" data-testid="ai-dialog">
        <DialogHeader>
          <DialogTitle>AI assistant</DialogTitle>
        </DialogHeader>

        <ApiKeyBanner />

        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Button
              key={t.value}
              size="xs"
              variant={tab === t.value ? 'default' : 'secondary'}
              onClick={() => setTab(t.value)}
              data-testid={`ai-tab-${t.value}`}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {tab === 'generate' && <GenerateTab />}
          {tab === 'suggest-fks' && <SuggestFksTab />}
          {tab === 'explain' && <ExplainTab />}
          {tab === 'infer-types' && <InferTypesTab />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
