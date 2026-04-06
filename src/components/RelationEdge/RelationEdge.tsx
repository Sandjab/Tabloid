import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import { ENDPOINT_LABELS, EDGE_COLOR, EDGE_COLOR_SELECTED } from '@/types/schema';
import type { RelationType, HandleSide } from '@/types/schema';
import { useSchemaStore } from '@/store/useSchemaStore';

const EDGE_SPREAD = 16;
const BORDER_RADIUS = 8;
const LABEL_OFFSET = 18;
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

/**
 * Build a self-referencing loop path (same table, different columns).
 */
function buildSelfRefPath(
  sx: number, sy: number,
  tx: number, ty: number,
  sourceSide: HandleSide,
  targetSide: HandleSide,
  spreadOffset: number,
): PathResult {
  const margin = SAME_SIDE_MARGIN + spreadOffset;

  if (sourceSide === targetSide) {
    // Both on same side: U-loop outward
    return buildSameSidePath(sx, sy, tx, ty, sourceSide, spreadOffset);
  }

  // Different sides (right→left or left→right): loop around the table
  const srcDir = sourceSide === 'right' ? 1 : -1;
  const tgtDir = targetSide === 'left' ? -1 : 1;
  const dy = ty - sy;
  // Go outward and loop above or below depending on relative Y
  const loopDir = dy >= 0 ? -1 : 1; // if target is below, loop above, vice versa
  const loopY = (loopDir > 0 ? Math.max(sy, ty) : Math.min(sy, ty)) + loopDir * margin;

  const outSx = sx + srcDir * margin;
  const outTx = tx + tgtDir * margin;
  const r = Math.min(BORDER_RADIUS, Math.abs(loopY - sy) / 2, Math.abs(loopY - ty) / 2);
  const ySrc = loopY > sy ? 1 : -1;
  const yTgt = ty > loopY ? 1 : -1;

  const path = [
    `M ${sx},${sy}`,
    `L ${outSx - srcDir * r},${sy}`,
    `Q ${outSx},${sy} ${outSx},${sy + ySrc * r}`,
    `L ${outSx},${loopY - ySrc * r}`,
    `Q ${outSx},${loopY} ${outSx + (outTx > outSx ? 1 : -1) * r},${loopY}`,
    `L ${outTx - (outTx > outSx ? 1 : -1) * r},${loopY}`,
    `Q ${outTx},${loopY} ${outTx},${loopY + yTgt * r}`,
    `L ${outTx},${ty - yTgt * r}`,
    `Q ${outTx},${ty} ${outTx - tgtDir * r},${ty}`,
    `L ${tx},${ty}`,
  ].join(' ');

  return [path, sx + srcDir * LABEL_OFFSET, sy, tx - tgtDir * LABEL_OFFSET, ty];
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

  const handleLabelClick = (endpoint: 'source' | 'target') => (e: React.MouseEvent) => {
    e.stopPropagation();
    const labels = ENDPOINT_LABELS[relationType];
    const current = endpoint === 'source' ? labels.source : labels.target;
    const newLabel = current === '1' ? 'N' : '1';
    const newSource = endpoint === 'source' ? newLabel : labels.source;
    const newTarget = endpoint === 'target' ? newLabel : labels.target;
    updateRelationType(id, LABEL_TYPE_MAP[`${newSource}-${newTarget}`]);
  };

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
            className="nodrag nopan absolute z-10 cursor-pointer text-[10px] font-bold leading-none transition-colors hover:text-blue-600"
            style={{
              transform: `translate(-50%, -100%) translate(${srcLabelX}px,${srcLabelY - 4}px)`,
              color: edgeColor,
            }}
            title="Click to toggle"
            data-testid={`edge-label-source-${id}`}
            onClick={handleLabelClick('source')}
          >
            {sourceLabel}
          </div>
          <div
            className="nodrag nopan absolute z-10 cursor-pointer text-[10px] font-bold leading-none transition-colors hover:text-blue-600"
            style={{
              transform: `translate(-50%, -100%) translate(${tgtLabelX}px,${tgtLabelY - 4}px)`,
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
    </>
  );
});

export default RelationEdge;
