import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <TooltipProvider delay={300}>
        <App />
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </ReactFlowProvider>
  </StrictMode>,
);
