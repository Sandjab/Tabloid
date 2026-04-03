import { EDGE_COLOR } from '@/types/schema';

export default function CrowFootMarkers() {
  return (
    <svg className="absolute h-0 w-0">
      <defs>
        <marker
          id="crowfoot-one"
          viewBox="0 0 12 12"
          refX="6"
          refY="6"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <line x1="6" y1="2" x2="6" y2="10" stroke={EDGE_COLOR} strokeWidth="1.5" />
        </marker>

        <marker
          id="crowfoot-many"
          viewBox="0 0 12 12"
          refX="6"
          refY="6"
          markerWidth="12"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <line x1="0" y1="2" x2="6" y2="6" stroke={EDGE_COLOR} strokeWidth="1.5" />
          <line x1="0" y1="10" x2="6" y2="6" stroke={EDGE_COLOR} strokeWidth="1.5" />
          <line x1="0" y1="6" x2="6" y2="6" stroke={EDGE_COLOR} strokeWidth="1.5" />
        </marker>
      </defs>
    </svg>
  );
}
