import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { downloadDataUrl } from './download';

const PADDING = 40;
const PRINT_STYLE_ID = 'tabloid-print-style';
const PRINT_CLASS = 'tabloid-print';

const PRINT_CSS = `
/* === TABLE CARDS === */
.${PRINT_CLASS} .react-flow__node > div {
  box-shadow: none !important;
  background: #ffffff !important;
  border: 1px solid #d1d5db !important;
  --tw-ring-shadow: 0 0 #0000 !important;
  --tw-ring-color: transparent !important;
}
/* Force dark text on all node content (fixes dark theme) */
.${PRINT_CLASS} .react-flow__node * {
  color: #1f2937 !important;
}
/* Keep header text white on colored background */
.${PRINT_CLASS} .react-flow__node [style*="background-color"] * {
  color: #ffffff !important;
}

/* === HIDE INTERACTIVE CHROME === */
.${PRINT_CLASS} .react-flow__handle {
  opacity: 0 !important;
}
.${PRINT_CLASS} [data-testid^="column-drag-handle"] {
  display: none !important;
}
.${PRINT_CLASS} [data-testid^="column-remove"] {
  display: none !important;
}
/* Header action buttons (Palette, StickyNote, +) */
.${PRINT_CLASS} [style*="background-color"] .nodrag {
  display: none !important;
}
/* "+ Add index" button */
.${PRINT_CLASS} [data-testid^="add-index-btn"] {
  display: none !important;
}

/* === STATIC LOOK === */
.${PRINT_CLASS} .react-flow__node button {
  cursor: default !important;
  pointer-events: none !important;
}
.${PRINT_CLASS} .react-flow__node select {
  appearance: none !important;
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  color: #6b7280 !important;
  pointer-events: none !important;
}
.${PRINT_CLASS} [data-testid^="index-row"] {
  cursor: default !important;
  pointer-events: none !important;
}

/* === CONSTRAINT COLORS === */
.${PRINT_CLASS} .text-rose-500 { color: #ef4444 !important; }
.${PRINT_CLASS} .text-violet-500 { color: #8b5cf6 !important; }
.${PRINT_CLASS} .text-amber-500 { color: #f59e0b !important; }
.${PRINT_CLASS} .text-muted-foreground\\/60 { color: #d1d5db !important; }
/* Inactive PK dot: hide */
.${PRINT_CLASS} .text-border { color: transparent !important; }

/* === EDGES === */
/* Hide selection glow layer */
.${PRINT_CLASS} .react-flow__edge path[stroke-opacity="0.15"] {
  display: none !important;
}
/* Edge labels: static, muted */
.${PRINT_CLASS} .react-flow__edgelabel-renderer .nodrag {
  cursor: default !important;
  pointer-events: none !important;
  color: #6b7280 !important;
}
`;

function getViewportElement(): HTMLElement {
  const el = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!el) throw new Error('React Flow viewport not found');
  return el;
}

function getReactFlowWrapper(): HTMLElement {
  const el = document.querySelector('.react-flow') as HTMLElement | null;
  if (!el) throw new Error('React Flow wrapper not found');
  return el;
}

// Saved modifications to restore after capture
let savedStrokes: { el: Element; type: 'attr' | 'style'; key: string; value: string }[] = [];

function injectPrintMode(): void {
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
  getReactFlowWrapper().classList.add(PRINT_CLASS);

  savedStrokes = [];
  const rootStyle = getComputedStyle(document.documentElement);

  document.querySelectorAll('.react-flow__edge path').forEach((path) => {
    const svgEl = path as SVGElement;

    // Resolve CSS variable strokes (e.g. var(--edge-color)) to computed values
    // so html-to-image can render them correctly
    const inlineStroke = svgEl.style.stroke;
    if (inlineStroke?.startsWith('var(')) {
      const varName = inlineStroke.slice(4, inlineStroke.indexOf(')')).trim();
      const resolved = rootStyle.getPropertyValue(varName).trim();
      if (resolved) {
        savedStrokes.push({ el: path, type: 'style', key: 'stroke', value: inlineStroke });
        svgEl.style.stroke = resolved;
      }
    }

    // Hide bridge paths — white on white bg is already invisible,
    // but force display:none to be safe
    const attrStroke = path.getAttribute('stroke');
    if (attrStroke === 'white') {
      savedStrokes.push({ el: path, type: 'style', key: 'display', value: svgEl.style.display || '' });
      svgEl.style.display = 'none';
    }
  });

  // Extend edge path endpoints to exactly reach table borders.
  // Compute exact border X from node positions instead of guessing offsets.
  const { edges, nodes: storeNodes } = useSchemaStore.getState();
  const edgeMap = new Map(edges.map((e) => [e.id, e]));
  const nodeMap = new Map(storeNodes.map((n) => [n.id, n]));

  // Current viewport zoom
  const vpEl = document.querySelector('.react-flow__viewport');
  const zoomMatch = vpEl?.getAttribute('style')?.match(/scale\(([\d.]+)\)/);
  const zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 1;

  // Get measured node widths from the DOM (accounts for flex content)
  const measuredWidths = new Map<string, number>();
  document.querySelectorAll('.react-flow__node').forEach((el) => {
    const id = el.getAttribute('data-id');
    if (id) measuredWidths.set(id, el.getBoundingClientRect().width / zoom);
  });

  document.querySelectorAll('.react-flow__edge-path').forEach((path) => {
    const edgeEl = path.closest('.react-flow__edge');
    const edgeId = edgeEl?.getAttribute('data-id') ?? '';
    const edge = edgeMap.get(edgeId);
    if (!edge) return;

    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);
    if (!srcNode || !tgtNode) return;

    const d = path.getAttribute('d');
    if (!d) return;

    const mMatch = d.match(/^M\s+([\d.-]+),([\d.-]+)/);
    if (!mMatch) return;
    const lMatches = [...d.matchAll(/L\s+([\d.-]+),([\d.-]+)/g)];
    if (lMatches.length === 0) return;
    const lastL = lMatches[lMatches.length - 1];
    const lastY = parseFloat(lastL[2]);

    const srcSide = edge.data?.sourceSide ?? 'right';
    const tgtSide = edge.data?.targetSide ?? 'left';
    const srcWidth = measuredWidths.get(edge.source) ?? (srcNode.measured?.width ?? 250);
    const tgtWidth = measuredWidths.get(edge.target) ?? (tgtNode.measured?.width ?? 250);

    // Exact border X positions (1px overshoot to cover sub-pixel gaps)
    const srcBorderX = srcSide === 'right'
      ? srcNode.position.x + srcWidth + 1
      : srcNode.position.x - 1;
    const tgtBorderX = tgtSide === 'right'
      ? tgtNode.position.x + tgtWidth + 1
      : tgtNode.position.x - 1;

    savedStrokes.push({ el: path, type: 'attr', key: 'd', value: d });

    let newD = d.replace(/^M\s+[\d.-]+,/, `M ${srcBorderX},`);
    const lastLRegex = /L\s+([\d.-]+),([\d.-]+)(?![\s\S]*L\s)/;
    newD = newD.replace(lastLRegex, `L ${tgtBorderX},${lastY}`);

    path.setAttribute('d', newD);
  });
}

function removePrintMode(): void {
  document.getElementById(PRINT_STYLE_ID)?.remove();
  document.querySelector(`.${PRINT_CLASS}`)?.classList.remove(PRINT_CLASS);

  for (const { el, type, key, value } of savedStrokes) {
    if (type === 'style') {
      (el as SVGElement).style.setProperty(key, value);
    } else {
      el.setAttribute(key, value);
    }
  }
  savedStrokes = [];
}

function filterChrome(node: HTMLElement): boolean {
  const classes = node.classList;
  if (!classes) return true;
  return ![
    'react-flow__controls',
    'react-flow__minimap',
    'react-flow__background',
    'react-flow__attribution',
    'react-flow__panel',
  ].some((c) => classes.contains(c));
}

function computeExportOptions(bounds: { x: number; y: number; width: number; height: number }) {
  const width = bounds.width + PADDING * 2;
  const height = bounds.height + PADDING * 2;
  return {
    width,
    height,
    backgroundColor: '#ffffff',
    style: {
      transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px)`,
      transformOrigin: 'top left',
      width: 'auto',
      height: 'auto',
    },
    filter: filterChrome,
  };
}

export async function exportPNG(filename = 'schema.png'): Promise<void> {
  const { nodes } = useSchemaStore.getState();
  if (nodes.length === 0) return;

  const bounds = getNodesBounds(nodes);
  const el = getViewportElement();

  injectPrintMode();
  try {
    const dataUrl = await toPng(el, computeExportOptions(bounds));
    downloadDataUrl(dataUrl, filename);
  } finally {
    removePrintMode();
  }
}

export async function exportSVG(filename = 'schema.svg'): Promise<void> {
  const { nodes } = useSchemaStore.getState();
  if (nodes.length === 0) return;

  const bounds = getNodesBounds(nodes);
  const el = getViewportElement();

  injectPrintMode();
  try {
    const dataUrl = await toSvg(el, computeExportOptions(bounds));
    downloadDataUrl(dataUrl, filename);
  } finally {
    removePrintMode();
  }
}
