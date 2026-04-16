import { useState, useCallback, useEffect } from 'react';
import Canvas from '@/components/Canvas/Canvas';
import Toolbar from '@/components/Toolbar/Toolbar';
import SearchDialog from '@/components/SearchDialog/SearchDialog';
import ExportDialog from '@/components/ExportDialog/ExportDialog';
import DiffDialog from '@/components/DiffDialog/DiffDialog';
import ValidationDialog from '@/components/ValidationDialog/ValidationDialog';
import AiDialog from '@/components/AiDialog/AiDialog';
import { useAutoSave, loadFromLocalStorage } from '@/hooks/useAutoSave';
import { useSchemaStore } from '@/store/useSchemaStore';
import { decodeSchemaFromHash, clearShareHash } from '@/utils/url-share';
import { toast } from 'sonner';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [lintOpen, setLintOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const openSearch = useCallback(() => { setSearchKey((k) => k + 1); setSearchOpen(true); }, []);
  const openExport = useCallback(() => setExportOpen(true), []);
  const openDiff = useCallback(() => setDiffOpen(true), []);
  const openLint = useCallback(() => setLintOpen(true), []);
  const openAi = useCallback(() => setAiOpen(true), []);

  useAutoSave();
  useEffect(() => {
    // Shared URL takes precedence over localStorage — a pasted link should show
    // that link's schema, not whatever was last edited locally.
    const shared = decodeSchemaFromHash(window.location.hash);
    if (shared) {
      useSchemaStore.getState().loadSchema(
        shared.tables,
        shared.relations,
        shared.name,
        shared.dialect,
      );
      clearShareHash();
      toast(`Loaded shared schema "${shared.name}"`);
      return;
    }
    loadFromLocalStorage();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Toolbar
        onSearchOpen={openSearch}
        onExportOpen={openExport}
        onDiffOpen={openDiff}
        onLintOpen={openLint}
        onAiOpen={openAi}
      />
      <Canvas onSearchOpen={openSearch} />
      <SearchDialog key={searchKey} open={searchOpen} onOpenChange={setSearchOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <DiffDialog open={diffOpen} onOpenChange={setDiffOpen} />
      <ValidationDialog open={lintOpen} onOpenChange={setLintOpen} />
      <AiDialog open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
