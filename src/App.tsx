import { useState, useCallback, useEffect } from 'react';
import Canvas from '@/components/Canvas/Canvas';
import Toolbar from '@/components/Toolbar/Toolbar';
import SearchDialog from '@/components/SearchDialog/SearchDialog';
import ExportDialog from '@/components/ExportDialog/ExportDialog';
import ValidationPanel from '@/components/ValidationPanel/ValidationPanel';
import { useAutoSave, loadFromLocalStorage } from '@/hooks/useAutoSave';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openExport = useCallback(() => setExportOpen(true), []);
  const closeExport = useCallback(() => setExportOpen(false), []);

  useAutoSave();
  useEffect(() => { loadFromLocalStorage(); }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-white dark:bg-gray-900">
      <Toolbar onSearchOpen={openSearch} onExportOpen={openExport} />
      <Canvas onSearchOpen={openSearch} />
      {searchOpen && <SearchDialog onClose={closeSearch} />}
      {exportOpen && <ExportDialog onClose={closeExport} />}
      <ValidationPanel />
    </div>
  );
}
