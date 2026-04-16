import { useState } from 'react';
import { useApiKey } from '@/hooks/useApiKey';
import { useSchemaStore } from '@/store/useSchemaStore';
import { explainSchema } from '@/utils/ai/explain-schema';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, Loader2, BookText } from 'lucide-react';

export default function ExplainTab() {
  const { key, hasKey } = useApiKey();
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);

  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setError(null);
    setMarkdown(null);
    setLoading(true);
    try {
      const md = await explainSchema(tables, relations, key);
      setMarkdown(md);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    toast.success('Markdown copied to clipboard');
  };

  if (tables.length === 0) {
    return (
      <div className="rounded-md bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
        Add at least one table before asking for an explanation.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Claude writes a markdown README-ready description of your schema (overview, main tables, relationships).
      </p>

      <Button
        onClick={handleGenerate}
        disabled={!hasKey || loading}
        data-testid="ai-explain-btn"
      >
        {loading ? (
          <>
            <Loader2 className="mr-1 size-3.5 animate-spin" /> Generating…
          </>
        ) : (
          <>
            <BookText className="mr-1 size-3.5" /> Generate explanation
          </>
        )}
      </Button>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {markdown && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              size="xs"
              variant="outline"
              onClick={handleCopy}
              data-testid="ai-explain-copy-btn"
            >
              <Copy className="mr-1 size-3.5" /> Copy markdown
            </Button>
          </div>
          <pre
            className="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-foreground"
            data-testid="ai-explain-output"
          >
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
