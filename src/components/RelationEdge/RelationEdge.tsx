import { memo, useRef, useState, useEffect } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import { ENDPOINT_LABELS, EDGE_COLOR, EDGE_COLOR_SELECTED } from '@/types/schema';
import type { RelationType, HandleSide } from '@/types/schema';
import { useSchemaStore } from '@/store/useSchemaStore';
import { toast } from 'sonner';

const EDGE_SPREAD = 16;
const BORDER_RADIUS = 8;
const LABEL_OFFSET = 10;
// React Flow's translate(50%) on handles pushes the reported sourceX/targetX
// past the table border by half the handle width (w-[13px] → 6.5px).
const HANDLE_HALF_W = 6.5;
// Extra margin for same-side U-shaped paths
const SAME_SIDE_MARGIN = 40;

interface RelationEdgeData {
  relationType: RelationType;
  siblingIndex: number;
  siblingCount: number;
  bundleIndex: number;
  bundleCount: number;
  sourceSide: HandleSide;
  targetSide: HandleSide;
  [key: string]: unknown;
}

type RelationEdgeType = Edge<RelationEdgeData, 'relation'>;

type PathResult = [string, number, number, number, number];

/**
 * Build a 3-segment step path: horizontal → vertical → horizontal.
 * Works for right→left and left→right layouts.
 * Returns [svgPath, srcLabelX, srcLabelY, tgtLabelX, tgtLabelY].
 */
function buildCrossPath(
  sx: number, sy: number,
  tx: number, ty: number,
  turnX: number,
  srcDir: 1 | -1,
  tgtDir: 1 | -1,
): PathResult {
  const dy = ty - sy;

  // Degenerate: same Y → straight horizontal line
  if (Math.abs(dy) < 1) {
    return [
      `M ${sx},${sy} L ${tx},${ty}`,
      sx + srcDir * LABEL_OFFSET, sy,
      tx + tgtDir * LABEL_OFFSET, ty,
    ];
  }

  const r = Math.min(BORDER_RADIUS, Math.abs(dy) / 2, Math.abs(turnX - sx), Math.abs(tx - turnX));
  const ySign = dy > 0 ? 1 : -1;
  const xSign1 = turnX > sx ? 1 : -1;
  const xSign2 = tx > turnX ? 1 : -1;

  const path = [
    `M ${sx},${sy}`,
    `L ${turnX - xSign1 * r},${sy}`,
    `Q ${turnX},${sy} ${turnX},${sy + ySign * r}`,
    `L ${turnX},${ty - ySign * r}`,
    `Q ${turnX},${ty} ${turnX + xSign2 * r},${ty}`,
    `L ${tx},${ty}`,
  ].join(' ');

  return [path, sx + srcDir * LABEL_OFFSET, sy, tx + tgtDir * LABEL_OFFSET, ty];
}

/**
 * Build a U-shaped path for same-side connections (right→right or left→left).
 * The vertical segment goes outward from both endpoints.
 */
function buildSameSidePath(
  sx: number, sy: number,
  tx: number, ty: number,
  side: HandleSide,
  spreadOffset: number,
): PathResult {
  const dir = side === 'right' ? 1 : -1;
  const outX = (side === 'right' ? Math.max(sx, tx) : Math.min(sx, tx)) + dir * SAME_SIDE_MARGIN + spreadOffset;
  const dy = ty - sy;

  if (Math.abs(dy) < 1) {
    // Same Y, same side: arc out and back
    const arcR = SAME_SIDE_MARGIN / 2;
    const path = [
      `M ${sx},${sy}`,
      `L ${sx + dir * arcR},${sy}`,
      `Q ${outX},${sy} ${outX},${sy + arcR}`,
      `Q ${outX},${ty} ${tx + dir * arcR},${ty}`,
      `L ${tx},${ty}`,
    ].join(' ');
    return [path, sx + dir * LABEL_OFFSET, sy, tx + dir * LABEL_OFFSET, ty];
  }

  const r = Math.min(BORDER_RADIUS, Math.abs(dy) / 2, Math.abs(outX - sx), Math.abs(outX - tx));
  const ySign = dy > 0 ? 1 : -1;

  const path = [
    `M ${sx},${sy}`,
    `L ${outX - dir * r},${sy}`,
    `Q ${outX},${sy} ${outX},${sy + ySign * r}`,
    `L ${outX},${ty - ySign * r}`,
    `Q ${outX},${ty} ${outX - dir * r},${ty}`,
    `L ${tx},${ty}`,
  ].join(' ');

  return [path, sx + dir * LABEL_OFFSET, sy, tx + dir * LABEL_OFFSET, ty];
}

const LABEL_TYPE_MAP: Record<string, RelationType> = {
  '1-1': 'one-to-one',
  '1-N': 'one-to-many',
  'N-1': 'many-to-one',
  'N-N': 'many-to-many',
};

const RelationEdge = memo(function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationEdgeType>) {
  const siblingIndex = data?.siblingIndex ?? 0;
  const siblingCount = data?.siblingCount ?? 1;
  const spreadOffset = (siblingIndex - (siblingCount - 1) / 2) * EDGE_SPREAD;

  const bundleIndex = data?.bundleIndex ?? 0;
  const bundleCount = data?.bundleCount ?? 1;
  const stepPosition = bundleCount <= 1
    ? 0.5
    : 0.3 + (bundleIndex / (bundleCount - 1)) * 0.4;

  const sourceSide: HandleSide = data?.sourceSide ?? 'right';
  const targetSide: HandleSide = data?.targetSide ?? 'left';

  // Edge endpoints pulled to ~1px inside the table border based on side
  const sx = sourceSide === 'right' ? sourceX - HANDLE_HALF_W : sourceX + HANDLE_HALF_W;
  const tx = targetSide === 'left' ? targetX + HANDLE_HALF_W : targetX - HANDLE_HALF_W;

  // Determine path based on side combination
  let edgePath: string;
  let srcLabelX: number, srcLabelY: number, tgtLabelX: number, tgtLabelY: number;

  const sameSide = sourceSide === targetSide;
  const srcDir: 1 | -1 = sourceSide === 'right' ? 1 : -1;
  const tgtDir: 1 | -1 = targetSide === 'left' ? -1 : 1;

  if (sameSide) {
    // Same-side: U-shaped path
    [edgePath, srcLabelX, srcLabelY, tgtLabelX, tgtLabelY] =
      buildSameSidePath(sx, sourceY, tx, targetY, sourceSide, spreadOffset);
  } else {
    // Cross-side: right→left or left→right
    const effectiveDist = srcDir * (tx - sx);
    const isNormalLayout = effectiveDist > 40;

    if (isNormalLayout) {
      const turnX = sx + (tx - sx) * stepPosition + spreadOffset;
      [edgePath, srcLabelX, srcLabelY, tgtLabelX, tgtLabelY] =
        buildCrossPath(sx, sourceY, tx, targetY, turnX, srcDir, tgtDir);
    } else {
      // Reversed layout or very close — use React Flow's smooth step
      [edgePath] = getSmoothStepPath({
        sourceX: sx, sourceY, targetX: tx, targetY,
        sourcePosition, targetPosition,
        borderRadius: BORDER_RADIUS,
      });
      srcLabelX = sx + srcDir * LABEL_OFFSET;
      srcLabelY = sourceY;
      tgtLabelX = tx + tgtDir * LABEL_OFFSET;
      tgtLabelY = targetY;
    }
  }

  const relationType = data?.relationType ?? 'one-to-many';
  const { source: sourceLabel, target: targetLabel } = ENDPOINT_LABELS[relationType];

  const edgeColor = selected ? EDGE_COLOR_SELECTED : EDGE_COLOR;
  const strokeWidth = selected ? 2.5 : 1.5;

  const dx = tx - sx;
  const dy = targetY - sourceY;
  const showLabels = Math.sqrt(dx * dx + dy * dy) >= 50;

  const updateRelationType = useSchemaStore((s) => s.updateRelationType);
  const convertToJunction = useSchemaStore((s) => s.convertToJunction);

  // Ghost preview state for N:N → junction table
  const [ghostVisible, setGhostVisible] = useState(false);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const solidifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTypeRef = useRef<RelationType | null>(null);

  const cancelGhost = () => {
    if (ghostTimerRef.current) { clearTimeout(ghostTimerRef.current); ghostTimerRef.current = null; }
    if (solidifyTimerRef.current) { clearTimeout(solidifyTimerRef.current); solidifyTimerRef.current = null; }
    setGhostVisible(false);
  };

  // Cleanup on unmount
  useEffect(() => cancelGhost, []);

  // Click-outside detection: cancel ghost when clicking anywhere except the ghost
  useEffect(() => {
    if (!ghostVisible) return;
    const handleClickOutside = () => {
      cancelGhost();
      if (prevTypeRef.current) {
        updateRelationType(id, prevTypeRef.current);
        prevTypeRef.current = null;
      }
    };
    // Delay to avoid catching the click that triggered the ghost
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClickOutside, { once: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [ghostVisible, id, updateRelationType]);

  const handleLabelClick = (endpoint: 'source' | 'target') => (e: React.MouseEvent) => {
    e.stopPropagation();
    const labels = ENDPOINT_LABELS[relationType];
    const current = endpoint === 'source' ? labels.source : labels.target;
    const newLabel = current === '1' ? 'N' : '1';
    const newSource = endpoint === 'source' ? newLabel : labels.source;
    const newTarget = endpoint === 'target' ? newLabel : labels.target;
    const newType = LABEL_TYPE_MAP[`${newSource}-${newTarget}`];

    if (newType === 'many-to-many') {
      // Cancel any existing ghost timer (re-click scenario)
      cancelGhost();

      // Remember previous type for cancel/revert
      prevTypeRef.current = relationType;

      // Show N:N labels immediately
      updateRelationType(id, 'many-to-many');

      // Schedule ghost preview at 200ms
      ghostTimerRef.current = setTimeout(() => setGhostVisible(true), 200);

      // Convert to junction table at 1700ms
      solidifyTimerRef.current = setTimeout(() => {
        const state = useSchemaStore.getState();
        const rel = state.relations.find((r) => r.id === id);
        if (!rel) return;
        const srcTable = state.tables.find((t) => t.id === rel.sourceTableId);
        const tgtTable = state.tables.find((t) => t.id === rel.targetTableId);
        const junctionName = `${srcTable?.name ?? 'table'}_${tgtTable?.name ?? 'table'}`;

        convertToJunction(id);

        toast(`Junction table "${junctionName}" created`, {
          action: {
            label: 'Undo',
            onClick: () => {
              const temporal = useSchemaStore.temporal.getState();
              temporal.undo();
              temporal.pause();
              try { useSchemaStore.getState().rebuildNodesFromTables(); }
              finally { temporal.resume(); }
            },
          },
          duration: 4000,
        });
      }, 1700);
    } else {
      // Normal toggle — also cancel any pending ghost
      cancelGhost();
      updateRelationType(id, newType);
    }
  };

  // Ghost click → solidify immediately
  const handleGhostClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    cancelGhost();

    const state = useSchemaStore.getState();
    const rel = state.relations.find((r) => r.id === id);
    if (!rel) return;
    const srcTable = state.tables.find((t) => t.id === rel.sourceTableId);
    const tgtTable = state.tables.find((t) => t.id === rel.targetTableId);
    const junctionName = `${srcTable?.name ?? 'table'}_${tgtTable?.name ?? 'table'}`;

    convertToJunction(id);

    toast(`Junction table "${junctionName}" created`, {
      action: {
        label: 'Undo',
        onClick: () => {
              const temporal = useSchemaStore.temporal.getState();
              temporal.undo();
              temporal.pause();
              try { useSchemaStore.getState().rebuildNodesFromTables(); }
              finally { temporal.resume(); }
            },
      },
      duration: 4000,
    });
  };

  // Ghost position at midpoint
  const ghostX = (sourceX + targetX) / 2;
  const ghostY = (sourceY + targetY) / 2;

  return (
    <>
      {/* Glow layer when selected */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={EDGE_COLOR_SELECTED}
          strokeWidth={10}
          strokeOpacity={0.15}
          strokeLinecap="round"
        />
      )}
      {/* White outline creates a "bridge" effect at edge crossings */}
      <path
        d={edgePath}
        fill="none"
        stroke="white"
        strokeWidth={strokeWidth + 6}
        className="dark:stroke-[#1c2030]"
      />
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={0}
        style={{ stroke: edgeColor, strokeWidth }}
      />
      {showLabels && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute z-10 cursor-pointer text-xs font-bold leading-none transition-colors hover:text-blue-600"
            style={{
              transform: `translate(-50%, -100%) translate(${srcLabelX}px,${srcLabelY - 3}px)`,
              color: edgeColor,
            }}
            title="Click to toggle"
            data-testid={`edge-label-source-${id}`}
            onClick={handleLabelClick('source')}
          >
            {sourceLabel}
          </div>
          <div
            className="nodrag nopan absolute z-10 cursor-pointer text-xs font-bold leading-none transition-colors hover:text-blue-600"
            style={{
              transform: `translate(-50%, -100%) translate(${tgtLabelX}px,${tgtLabelY - 3}px)`,
              color: edgeColor,
            }}
            title="Click to toggle"
            data-testid={`edge-label-target-${id}`}
            onClick={handleLabelClick('target')}
          >
            {targetLabel}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* Ghost junction table preview */}
      {ghostVisible && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute z-20 cursor-pointer rounded-lg border-2 border-dashed border-blue-400 bg-white/80 px-3 py-2 text-xs shadow-sm dark:bg-gray-800/80"
            style={{
              transform: `translate(-50%, -50%) translate(${ghostX}px,${ghostY}px)`,
              opacity: 0.6,
            }}
            onClick={handleGhostClick}
            title="Click to create now"
          >
            <div className="mb-1 font-semibold text-blue-500">
              Junction table
            </div>
            <div className="text-muted-foreground">Click in or out</div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

export default RelationEdge;
