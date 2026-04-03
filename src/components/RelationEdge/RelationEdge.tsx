import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import { RELATION_TYPE_LABELS, EDGE_COLOR, EDGE_COLOR_SELECTED } from '@/types/schema';
import type { RelationType } from '@/types/schema';

interface RelationEdgeData {
  relationType: RelationType;
  [key: string]: unknown;
}

type RelationEdgeType = Edge<RelationEdgeData, 'relation'>;

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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

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
      {/* White outline creates a "bridge" effect at edge crossings */}
      <path
        d={edgePath}
        fill="none"
        stroke="white"
        strokeWidth={strokeWidth + 6}
        className="dark:stroke-gray-800"
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
          className="nodrag nopan pointer-events-auto absolute rounded bg-white px-1.5 py-0.5 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-700 dark:text-gray-300"
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
