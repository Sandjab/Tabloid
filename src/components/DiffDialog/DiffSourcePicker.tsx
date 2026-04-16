import { useRef, useState } from 'react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useDiffStore } from '@/store/useDiffStore';
import {
  listTags,
  saveTag,
  loadTag,
  deleteTag,
  type TagMetadata,
} from '@/hooks/useTaggedVersions';
import { parseSQL } from '@/utils/import-sql';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DiffSourcePickerProps {
  onBaselineApplied: () => void;
}

export default function DiffSourcePicker({ onBaselineApplied }: DiffSourcePickerProps) {
  const tables = useSchemaStore((s) => s.tables);
  const relations = useSchemaStore((s) => s.relations);
  const schemaName = useSchemaStore((s) => s.schemaName);
  const dialect = useSchemaStore((s) => s.dialect);
  const setBaseline = useDiffStore((s) => s.setBaseline);

  const [tagName, setTagName] = useState('');
  const [tags, setTags] = useState<TagMetadata[]>(() => listTags(schemaName));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshTags = () => setTags(listTags(schemaName));

  const handleCreateTag = () => {
    const name = tagName.trim();
    if (!name) return;
    saveTag(schemaName, name, tables, relations, dialect);
    setTagName('');
    refreshTags();
    toast.success(`Tagged as “${name}”`);
  };

  const handleLoadTag = (name: string) => {
    const loaded = loadTag(schemaName, name);
    if (!loaded) {
      toast.error(`Tag “${name}” not found`);
      return;
    }
    setBaseline({
      tables: loaded.tables,
      relations: loaded.relations,
      source: {
        kind: 'tag',
        name,
        importedAt: loaded.createdAt || new Date().toISOString(),
      },
    });
    onBaselineApplied();
  };

  const handleDeleteTag = (name: string) => {
    deleteTag(schemaName, name);
    refreshTags();
  };

  const handleLoadSQL = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const sql = await file.text();
      const { tables: bTables, relations: bRelations } = parseSQL(sql);
      setBaseline({
        tables: bTables,
        relations: bRelations,
        source: {
          kind: 'sql',
          name: file.name,
          importedAt: new Date().toISOString(),
        },
      });
      onBaselineApplied();
    } catch (err) {
      toast.error(`Failed to parse SQL: ${String(err)}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <section>
        <h4 className="mb-2 text-sm font-semibold">Tag current schema</h4>
        <div className="flex gap-2">
          <Input
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
            placeholder="e.g. v1"
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            data-testid="diff-tag-name-input"
          />
          <Button onClick={handleCreateTag} disabled={!tagName.trim()} data-testid="diff-create-tag-btn">
            <Tag className="mr-1 size-3.5" /> Tag
          </Button>
        </div>
      </section>

      {tags.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold">Compare with existing tag</h4>
          <ul className="space-y-1" data-testid="diff-tag-list">
            {tags.map((t) => (
              <li
                key={t.tagName}
                className="flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.tagName}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.tableCount} tables · {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => handleLoadTag(t.tagName)}
                    data-testid={`diff-compare-tag-${t.tagName}`}
                  >
                    Compare
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleDeleteTag(t.tagName)}
                    title="Delete tag"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-semibold">Compare with a SQL file</h4>
        <input
          ref={fileInputRef}
          type="file"
          accept=".sql,text/plain"
          onChange={handleLoadSQL}
          style={{ display: 'none' }}
          data-testid="diff-sql-file-input"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          data-testid="diff-load-sql-btn"
        >
          <Upload className="mr-1 size-3.5" /> Load SQL file
        </Button>
      </section>
    </div>
  );
}
