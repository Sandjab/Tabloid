import { useState, useCallback, useEffect } from 'react';
import Canvas from '@/components/Canvas/Canvas';
import Toolbar from '@/components/Toolbar/Toolbar';
import SearchDialog from '@/components/SearchDialog/SearchDialog';
import ExportDialog from '@/components/ExportDialog/ExportDialog';
import { useAutoSave, loadFromLocalStorage } from '@/hooks/useAutoSave';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openExport = useCallback(() => setExportOpen(true), []);

  useAutoSave();
  useEffect(() => { loadFromLocalStorage(); }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <Toolbar onSearchOpen={openSearch} onExportOpen={openExport} />
      <Canvas onSearchOpen={openSearch} />
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
