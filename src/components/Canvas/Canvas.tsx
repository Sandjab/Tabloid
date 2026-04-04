import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  useReactFlow,
  getNodesBounds,
  useStore,
} from '@xyflow/react';
import type { NodeTypes, EdgeTypes, Connection, IsValidConnection } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { parseHandleId } from '@/utils/id';
import { computeAutoLayout } from '@/utils/auto-layout';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Plus, Maximize, LayoutGrid, MousePointerClick } from 'lucide-react';
import TableNode from '@/components/TableNode/TableNode';
import RelationEdge from '@/components/RelationEdge/RelationEdge';
import CrowFootMarkers from '@/components/RelationEdge/CrowFootMarkers';
import RelationTypeDialog from '@/components/RelationTypeDialog/RelationTypeDialog';
import StatusBar from '@/components/StatusBar/StatusBar';
import type { RelationType, TableNodeData } from '@/types/schema';

const nodeTypes: NodeTypes = {
  table: TableNode,
};

const edgeTypes: EdgeTypes = {
  relation: RelationEdge,
};

const DOUBLE_CLICK_THRESHOLD = 300;

interface PendingConnection {
  sourceTableId: string;
  sourceColumnId: string;
  targetTableId: string;
  targetColumnId: string;
}

interface CanvasProps {
  onSearchOpen: () => void;
}

export default function Canvas({ onSearchOpen }: CanvasProps) {
  useKeyboardShortcuts({ onSearchOpen });
  const nodes = useSchemaStore((s) => s.nodes);
  const edges = useSchemaStore((s) => s.edges);
  const onNodesChange = useSchemaStore((s) => s.onNodesChange);
  const onEdgesChange = useSchemaStore((s) => s.onEdgesChange);
  const addTable = useSchemaStore((s) => s.addTable);
  const addRelation = useSchemaStore((s) => s.addRelation);
  const removeRelation = useSchemaStore((s) => s.removeRelation);
  const { screenToFlowPosition, setCenter, getZoom, fitView } = useReactFlow();
  const viewportWidth = useStore((s) => s.width);
  const viewportHeight = useStore((s) => s.height);

  const minZoom = useMemo(() => {
    const BASE_MIN = 0.2;
    const PADDING = 0.2;
    if (nodes.length === 0) return BASE_MIN;
    const bounds = getNodesBounds(nodes);
    if (bounds.width === 0 || bounds.height === 0) return BASE_MIN;
    const paddedWidth = bounds.width * (1 + PADDING * 2);
    const paddedHeight = bounds.height * (1 + PADDING * 2);
    const fitZoom = Math.min(viewportWidth / paddedWidth, viewportHeight / paddedHeight);
    return Math.min(BASE_MIN, fitZoom);
  }, [nodes, viewportWidth, viewportHeight]);

  const lastPaneClickTime = useRef(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contextMenuPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);

  const handleAddTableHere = useCallback(() => {
    const position = screenToFlowPosition(contextMenuPos.current);
    addTable(position);
  }, [screenToFlowPosition, addTable]);

  const handleAutoLayout = useCallback(() => {
    const { tables, relations, updateTablePositions } = useSchemaStore.getState();
    if (tables.length === 0) return;
    const positions = computeAutoLayout(tables, relations);
    updateTablePositions(positions);
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleSelectAll = useCallback(() => {
    const { nodes: allNodes } = useSchemaStore.getState();
    onNodesChange(
      allNodes.map((n) => ({
        type: 'select' as const,
        id: n.id,
        selected: true,
      })),
    );
  }, [onNodesChange]);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const handler = (e: MouseEvent) => {
      const minimap = container.querySelector<HTMLElement>('.react-flow__minimap');
      if (!minimap?.contains(e.target as Node)) return;
      const svg = minimap.querySelector<SVGSVGElement>('svg.react-flow__minimap-svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const flowX = vb.x + (e.clientX - rect.left) / rect.width * vb.width;
      const flowY = vb.y + (e.clientY - rect.top) / rect.height * vb.height;
      setCenter(flowX, flowY, { zoom: getZoom(), duration: 400 });
    };
    container.addEventListener('dblclick', handler, true);
    return () => container.removeEventListener('dblclick', handler, true);
  }, [setCenter, getZoom]);

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      const last = lastPaneClickTime.current;
      lastPaneClickTime.current = now;
      if (now - last < DOUBLE_CLICK_THRESHOLD) {
        lastPaneClickTime.current = 0;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        addTable(position);
      }
    },
    [screenToFlowPosition, addTable],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (!connection.sourceHandle || !connection.targetHandle) return;

      setPendingConnection({
        sourceTableId: connection.source,
        sourceColumnId: parseHandleId(connection.sourceHandle),
        targetTableId: connection.target,
        targetColumnId: parseHandleId(connection.targetHandle),
      });
    },
    [],
  );

  const handleRelationConfirm = useCallback(
    (type: RelationType) => {
      if (!pendingConnection) return;
      addRelation(
        pendingConnection.sourceTableId,
        pendingConnection.sourceColumnId,
        pendingConnection.targetTableId,
        pendingConnection.targetColumnId,
        type,
      );
      setPendingConnection(null);
    },
    [pendingConnection, addRelation],
  );

  const handleRelationCancel = useCallback(() => {
    setPendingConnection(null);
  }, []);

  const isValidConnection: IsValidConnection = useCallback(
    (connection) => {
      if (
        connection.source === connection.target &&
        connection.sourceHandle === connection.targetHandle
      ) {
        return false;
      }
      const sourceColId = parseHandleId(connection.sourceHandle ?? null);
      const targetColId = parseHandleId(connection.targetHandle ?? null);
      const { relations } = useSchemaStore.getState();
      return !relations.some(
        (r) =>
          (r.sourceColumnId === sourceColId && r.targetColumnId === targetColId) ||
          (r.sourceColumnId === targetColId && r.targetColumnId === sourceColId),
      );
    },
    [],
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: { id: string }[]) => {
      for (const edge of deletedEdges) {
        removeRelation(edge.id);
      }
    },
    [removeRelation],
  );

  return (
    <ContextMenu>
    <ContextMenuTrigger asChild>
    <div
      ref={canvasRef}
      className="flex h-screen w-screen flex-col"
      data-testid="canvas-container"
      onContextMenu={(e) => {
        contextMenuPos.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <div className="relative flex-1">
      <CrowFootMarkers />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={handlePaneClick}
        selectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        minZoom={minZoom}
        zoomOnDoubleClick={false}
        fitView
        data-testid="react-flow-canvas"
      >
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => (node.data as TableNodeData)?.table?.color ?? '#3b82f6'}
          data-testid="minimap"
        />
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground/50">
              Double-click or right-click to add a table
            </p>
          </div>
        )}
      </ReactFlow>
      <RelationTypeDialog
        open={!!pendingConnection}
        onConfirm={handleRelationConfirm}
        onCancel={handleRelationCancel}
      />
      </div>
      <StatusBar />
    </div>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-48" data-testid="canvas-context-menu">
      <ContextMenuItem onClick={handleAddTableHere} data-testid="ctx-add-table">
        <Plus className="mr-2 size-3.5" />
        Add table here
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleSelectAll} data-testid="ctx-select-all">
        <MousePointerClick className="mr-2 size-3.5" />
        Select all
      </ContextMenuItem>
      <ContextMenuItem onClick={handleAutoLayout} data-testid="ctx-auto-layout">
        <LayoutGrid className="mr-2 size-3.5" />
        Auto layout
      </ContextMenuItem>
      <ContextMenuItem onClick={handleFitView} data-testid="ctx-fit-view">
        <Maximize className="mr-2 size-3.5" />
        Fit view
      </ContextMenuItem>
    </ContextMenuContent>
    </ContextMenu>
  );
}
