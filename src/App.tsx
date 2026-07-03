import { useState, useCallback } from "react";
import { useCollections } from "./hooks/useCollections";
import { useCollection } from "./hooks/useCollection";
import { Sidebar } from "./components/Sidebar";
import { IconGrid } from "./components/IconGrid";
import { DetailPanel } from "./components/DetailPanel";
import "./App.css";

function App() {
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  const { collections, loading: collectionsLoading } = useCollections();
  const { data: collectionData, loading: collectionLoading } = useCollection(selectedPrefix);

  const handleSelectCollection = useCallback((prefix: string) => {
    setSelectedPrefix(prefix);
    setSelectedIcon(null);
  }, []);

  const handleSelectIcon = useCallback((name: string) => {
    setSelectedIcon((prev) => (prev === name ? null : name));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedIcon(null);
  }, []);

  const selectedCollectionInfo = collections.find((c) => c.prefix === selectedPrefix);

  return (
    <div className="app">
      <Sidebar
        collections={collections}
        selectedPrefix={selectedPrefix}
        onSelectCollection={handleSelectCollection}
        loading={collectionsLoading}
      />
      <main className="main-area">
        {!selectedPrefix ? (
          <div className="welcome">
            <h1>Iconify Browser</h1>
            <p>从左侧选择一个图标包开始浏览</p>
          </div>
        ) : collectionLoading ? (
          <div className="welcome">加载图标包...</div>
        ) : collectionData ? (
          <IconGrid
            collection={collectionData}
            collectionName={selectedCollectionInfo?.name ?? selectedPrefix}
            collectionPrefix={selectedPrefix}
            selectedIcon={selectedIcon}
            onSelectIcon={handleSelectIcon}
          />
        ) : (
          <div className="welcome error">加载失败</div>
        )}
      </main>
      {selectedIcon && collectionData && (
        <DetailPanel
          iconName={selectedIcon}
          collection={collectionData}
          collectionName={selectedCollectionInfo?.name ?? ""}
          collectionPrefix={selectedPrefix ?? ""}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

export default App;
