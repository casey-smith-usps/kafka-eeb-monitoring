import { useState } from 'react';
import { Network, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export default function Architecture() {
  const [zoom, setZoom] = useState(100);

  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center space-x-3">
            <Network className="w-8 h-8 text-blue-600" />
            <span>EEB Architecture</span>
          </h2>
          <p className="text-slate-500 mt-1">Enterprise Event Broker internal architecture and process flow</p>
        </div>

        <div className="flex items-center space-x-2 bg-white rounded-lg border border-slate-200 p-2">
          <button
            onClick={() => setZoom(Math.max(50, zoom - 10))}
            className="p-2 hover:bg-slate-100 rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5 text-slate-600" />
          </button>
          <span className="text-sm font-medium text-slate-700 px-2">{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(200, zoom + 10))}
            className="p-2 hover:bg-slate-100 rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={() => setZoom(100)}
            className="p-2 hover:bg-slate-100 rounded transition-colors"
            title="Reset zoom"
          >
            <Maximize2 className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 overflow-auto" style={{ height: 'calc(100vh - 200px)' }}>
        <iframe
          src="/eeb_complete_architecture.html"
          className="w-full border-none"
          style={{
            height: '100%',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            width: `${10000 / zoom}%`
          }}
          title="EEB Architecture"
        />
      </div>
    </div>
  );
}
