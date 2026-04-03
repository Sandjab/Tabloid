import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  useReactFlow,
} from '@xyflow/react';
import type { NodeTypes, EdgeTypes, Connection, IsValidConnection } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { parseHandleId } from '@/utils/id';
import TableNode from '@/components/TableNode/TableNode';
import RelationEdge from '@/components/RelationEdge/RelationEdge';
import CrowFootMarkers from '@/components/RelationEdge/CrowFootMarkers';
import RelationTypeDialog from '@/components/RelationTypeDialog/RelationTypeDialog';
import type { RelationType } from '@/types/schema';

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
  const { screenToFlowPosition } = useReactFlow();

  const lastPaneClickTime = useRef(0);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);

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
    <div className="h-screen w-screen" data-testid="canvas-container">
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
        zoomOnDoubleClick={false}
        fitView
        data-testid="react-flow-canvas"
      >
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor="#93c5fd"
          data-testid="minimap"
        />
        <div className="absolute -bottom-[1px] right-[73px] text-[10px] text-gray-400 dark:text-gray-600">
          Proudly clauded by JP GAVINI 04/2026
        </div>
      </ReactFlow>
      <RelationTypeDialog
        open={!!pendingConnection}
        onConfirm={handleRelationConfirm}
        onCancel={handleRelationCancel}
      />
    </div>
  );
}
