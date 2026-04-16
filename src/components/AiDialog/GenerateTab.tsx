import { useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';
import { useSchemaStore } from '@/store/useSchemaStore';
import {
  generateSchemaFromDescription,
  type GenerateSchemaResult,
} from '@/utils/ai/generate-schema';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

export default function GenerateTab() {
  const { key, hasKey } = useApiKey();
  const loadSchema = useSchemaStore((s) => s.loadSchema);
  const hasExistingSchema = useSchemaStore((s) => s.tables.length > 0);

  const [description, setDescription] = useState('');
  const [result, setResult] = useState<GenerateSchemaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const out = await generateSchemaFromDescription(description, key);
      if (out.tables.length === 0) {
        setError('The model returned no tables. Try a more specific description.');
      } else {
        setResult(out);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;
    if (hasExistingSchema) {
      const ok = confirm(
        `Replace the current schema with the generated one (${result.tables.length} tables, ${result.relations.length} relations)? Use Undo (Ctrl+Z) to revert.`,
      );
      if (!ok) return;
    }
    loadSchema(result.tables, result.relations, 'Generated');
    toast.success(`Applied ${result.tables.length} tables to canvas`);
    setResult(null);
    setDescription('');
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Describe the application
        </label>
        <textarea
          className="h-32 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="e.g. A blog app with users, posts, comments, tags, and likes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!hasKey || loading}
          data-testid="ai-generate-description"
        />
      </div>

      <Button
        onClick={handleGenerate}
        disabled={!hasKey || loading || !description.trim()}
        data-testid="ai-generate-btn"
      >
        {loading ? (
          <>
            <Loader2 className="mr-1 size-3.5 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-1 size-3.5" /> Generate schema
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-2 rounded-md border border-border bg-muted px-3 py-2 text-sm">
          <div className="font-medium">
            Generated: {result.tables.length} tables, {result.relations.length} relations
          </div>
          <ul className="ml-4 list-disc text-xs text-muted-foreground">
            {result.tables.map((t) => (
              <li key={t.id}>
                {t.name} ({t.columns.length} columns)
              </li>
            ))}
          </ul>
          <Button onClick={handleApply} data-testid="ai-generate-apply-btn">
            Apply to canvas
          </Button>
        </div>
      )}
    </div>
  );
}
