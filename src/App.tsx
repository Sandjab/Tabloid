import { useState, useCallback, useEffect } from 'react';
import Canvas from '@/components/Canvas/Canvas';
import Toolbar from '@/components/Toolbar/Toolbar';
import SearchDialog from '@/components/SearchDialog/SearchDialog';
import ExportDialog from '@/components/ExportDialog/ExportDialog';
import DiffDialog from '@/components/DiffDialog/DiffDialog';
import ValidationDialog from '@/components/ValidationDialog/ValidationDialog';
import { useAutoSave, loadFromLocalStorage } from '@/hooks/useAutoSave';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [lintOpen, setLintOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0);
  const openSearch = useCallback(() => { setSearchKey((k) => k + 1); setSearchOpen(true); }, []);
  const openExport = useCallback(() => setExportOpen(true), []);
  const openDiff = useCallback(() => setDiffOpen(true), []);
  const openLint = useCallback(() => setLintOpen(true), []);

  useAutoSave();
  useEffect(() => { loadFromLocalStorage(); }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Toolbar
        onSearchOpen={openSearch}
        onExportOpen={openExport}
        onDiffOpen={openDiff}
        onLintOpen={openLint}
      />
      <Canvas onSearchOpen={openSearch} />
      <SearchDialog key={searchKey} open={searchOpen} onOpenChange={setSearchOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <DiffDialog open={diffOpen} onOpenChange={setDiffOpen} />
      <ValidationDialog open={lintOpen} onOpenChange={setLintOpen} />
    </div>
  );
}
