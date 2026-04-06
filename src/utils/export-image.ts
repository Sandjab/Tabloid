import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds } from '@xyflow/react';
import { useSchemaStore } from '@/store/useSchemaStore';
import { downloadDataUrl } from './download';

const PADDING = 40;
const EDGE_COLOR = '#8b9bb5';
const PRINT_STYLE_ID = 'tabloid-print-style';
const PRINT_CLASS = 'tabloid-print';

const PRINT_CSS = `
/* Table card: white bg, no shadow, clean border */
.${PRINT_CLASS} .react-flow__node > div {
  box-shadow: none !important;
  background: #ffffff !important;
  border: 1px solid #d1d5db !important;
  --tw-ring-shadow: 0 0 #0000 !important;
  --tw-ring-color: transparent !important;
}
/* Force dark text on all node content (fixes dark theme white-on-white) */
.${PRINT_CLASS} .react-flow__node * {
  color: #1f2937 !important;
}
/* Keep header text white on colored background */
.${PRINT_CLASS} .react-flow__node .rounded-t-md[style*="background-color"] *:not(button):not(.nodrag *) {
  color: #ffffff !important;
}
/* Hide interactive UI chrome */
.${PRINT_CLASS} .react-flow__handle {
  opacity: 0 !important;
}
.${PRINT_CLASS} [data-testid^="column-drag-handle"] {
  display: none !important;
}
.${PRINT_CLASS} [data-testid^="column-remove"] {
  display: none !important;
}
.${PRINT_CLASS} .rounded-t-md .nodrag {
  display: none !important;
}
/* Make select look like plain text (no chevron) */
.${PRINT_CLASS} .react-flow__node select {
  appearance: none !important;
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
  color: #6b7280 !important;
}
/* Edge endpoint labels */
.${PRINT_CLASS} .nodrag.nopan {
  color: #6b7280 !important;
}
/* NN/UQ active badges: keep their colors */
.${PRINT_CLASS} .text-rose-500 { color: #ef4444 !important; }
.${PRINT_CLASS} .text-violet-500 { color: #8b5cf6 !important; }
.${PRINT_CLASS} .text-amber-500 { color: #f59e0b !important; }
/* Inactive badges: subtle gray */
.${PRINT_CLASS} .text-muted-foreground\\/60 { color: #d1d5db !important; }
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

// Saved bridge stroke attributes to restore after capture
let savedBridgeStrokes: { el: Element; attr: string; value: string }[] = [];

function injectPrintMode(): void {
  const style = document.createElement('style');
  style.id = PRINT_STYLE_ID;
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
  getReactFlowWrapper().classList.add(PRINT_CLASS);

  // Change bridge path stroke from white/dark to edge color so
  // the wider bridge extends the visible line to the table borders.
  // (In the live viewport, the bridge creates a "crossing" effect;
  //  in print on white bg, we repurpose it as line extension.)
  savedBridgeStrokes = [];
  document.querySelectorAll('.react-flow__edge path').forEach((path) => {
    const stroke = path.getAttribute('stroke');
    if (stroke === 'white') {
      savedBridgeStrokes.push({ el: path, attr: 'stroke', value: stroke });
      path.setAttribute('stroke', EDGE_COLOR);
    }
  });
}

function removePrintMode(): void {
  document.getElementById(PRINT_STYLE_ID)?.remove();
  document.querySelector(`.${PRINT_CLASS}`)?.classList.remove(PRINT_CLASS);

  for (const { el, attr, value } of savedBridgeStrokes) {
    el.setAttribute(attr, value);
  }
  savedBridgeStrokes = [];
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
