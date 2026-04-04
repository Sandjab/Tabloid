import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import { RELATION_TYPE_LABELS, EDGE_COLOR, EDGE_COLOR_SELECTED } from '@/types/schema';
import type { RelationType } from '@/types/schema';

const EDGE_SPREAD = 16;
const BORDER_RADIUS = 8;

interface RelationEdgeData {
  relationType: RelationType;
  siblingIndex: number;
  siblingCount: number;
  bundleIndex: number;
  bundleCount: number;
  [key: string]: unknown;
}

type RelationEdgeType = Edge<RelationEdgeData, 'relation'>;

/**
 * Build a clean 3-segment step path: horizontal → vertical → horizontal.
 * Returns [svgPath, labelX, labelY].
 */
function buildStepPath(
  sx: number, sy: number,
  tx: number, ty: number,
  turnX: number,
): [string, number, number] {
  const dy = ty - sy;

  // Degenerate: same Y → straight horizontal line
  if (Math.abs(dy) < 1) {
    return [`M ${sx},${sy} L ${tx},${ty}`, (sx + tx) / 2, sy];
  }

  const r = Math.min(BORDER_RADIUS, Math.abs(dy) / 2, Math.abs(turnX - sx), Math.abs(tx - turnX));
  const ySign = dy > 0 ? 1 : -1;
  const xSign1 = turnX > sx ? 1 : -1; // direction from source to turn
  const xSign2 = tx > turnX ? 1 : -1; // direction from turn to target

  const path = [
    `M ${sx},${sy}`,
    `L ${turnX - xSign1 * r},${sy}`,
    `Q ${turnX},${sy} ${turnX},${sy + ySign * r}`,
    `L ${turnX},${ty - ySign * r}`,
    `Q ${turnX},${ty} ${turnX + xSign2 * r},${ty}`,
    `L ${tx},${ty}`,
  ].join(' ');

  return [path, turnX, (sy + ty) / 2];
}

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

  // Spread bundles (edges from same source to different targets) across
  // the horizontal space so their vertical segments don't overlap.
  const bundleIndex = data?.bundleIndex ?? 0;
  const bundleCount = data?.bundleCount ?? 1;
  const stepPosition = bundleCount <= 1
    ? 0.5
    : 0.3 + (bundleIndex / (bundleCount - 1)) * 0.4;

  const sx = sourceX;
  const tx = targetX + 3;

  const turnX = sx + (tx - sx) * stepPosition + spreadOffset;

  // Use custom 3-segment path for normal left-to-right edges,
  // fall back to getSmoothStepPath for reversed/unusual layouts.
  let edgePath: string, labelX: number, labelY: number;
  const isNormalLayout = (tx - sx) > 40;

  if (isNormalLayout) {
    [edgePath, labelX, labelY] = buildStepPath(sx, sourceY, tx, targetY, turnX);
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX: sx, sourceY, targetX: tx, targetY,
      sourcePosition, targetPosition,
      borderRadius: BORDER_RADIUS,
    });
  }

  const relationType = data?.relationType ?? 'one-to-many';
  const label = RELATION_TYPE_LABELS[relationType].short;

  const sourceMarker = relationType === 'many-to-one' || relationType === 'many-to-many'
    ? 'url(#crowfoot-many)'
    : 'url(#crowfoot-one)';
  const targetMarker = relationType === 'one-to-many' || relationType === 'many-to-many'
    ? 'url(#crowfoot-many)'
    : 'url(#crowfoot-one)';

  const edgeColor = selected ? EDGE_COLOR_SELECTED : EDGE_COLOR;
  const strokeWidth = selected ? 2.5 : 1.5;

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
        style={{ stroke: edgeColor, strokeWidth }}
        markerStart={sourceMarker}
        markerEnd={targetMarker}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute rounded-sm bg-popover px-1 py-0.5 text-[8px] font-medium text-muted-foreground ring-1 ring-border dark:ring-0"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          data-testid={`edge-label-${id}`}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

export default RelationEdge;
