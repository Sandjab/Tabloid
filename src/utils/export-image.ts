import { toPng, toSvg } from 'html-to-image';
import { downloadDataUrl } from './download';

function getViewportElement(): HTMLElement {
  const el = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!el) throw new Error('React Flow viewport not found');
  return el;
}

export async function exportPNG(filename = 'schema.png'): Promise<void> {
  const el = getViewportElement();
  const dataUrl = await toPng(el, { backgroundColor: '#ffffff' });
  downloadDataUrl(dataUrl, filename);
}

export async function exportSVG(filename = 'schema.svg'): Promise<void> {
  const el = getViewportElement();
  const dataUrl = await toSvg(el, { backgroundColor: '#ffffff' });
  downloadDataUrl(dataUrl, filename);
}
