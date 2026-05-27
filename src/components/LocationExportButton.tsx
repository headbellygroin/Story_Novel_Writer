import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { proxyImageUrl } from '../lib/proxyFetch';
import { getEndpointConfig } from '../lib/endpointResolver';

export default function LocationExportButton() {
  const { currentProjectId } = useStore();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');

  async function exportLocationsZip() {
    if (!currentProjectId) return;

    setExporting(true);
    setProgress('Fetching locations...');

    try {
      const JSZip = (await import('jszip')).default;

      const { data: places, error } = await supabase
        .from('places')
        .select('name, description, image_url')
        .eq('project_id', currentProjectId)
        .order('name');

      if (error) throw error;
      if (!places || places.length === 0) {
        setProgress('No locations found.');
        setTimeout(() => setProgress(''), 2000);
        setExporting(false);
        return;
      }

      const config = await getEndpointConfig();
      const comfyEndpoint = config.isRemote && config.remoteComfy
        ? config.remoteComfy
        : config.localComfy || 'http://127.0.0.1:8188';

      const zip = new JSZip();

      const mdResponse = await fetch('/downloads/sailor_town_locations.md');
      if (mdResponse.ok) {
        const mdContent = await mdResponse.text();
        zip.file('universe_map_locations.md', mdContent);
      }

      const imagesFolder = zip.folder('images');
      let fetched = 0;

      for (const place of places) {
        if (!place.image_url) continue;

        fetched++;
        const safeName = place.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');
        setProgress(`Downloading image ${fetched}: ${place.name}...`);

        try {
          const resolvedUrl = proxyImageUrl(place.image_url, comfyEndpoint);
          const imgResponse = await fetch(resolvedUrl);
          if (imgResponse.ok) {
            const blob = await imgResponse.blob();
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            imagesFolder!.file(`${safeName}.${ext}`, blob);
          }
        } catch (imgErr) {
          console.warn(`Failed to fetch image for ${place.name}:`, imgErr);
        }
      }

      setProgress('Creating zip file...');
      const content = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'universe_map_locations.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress('');
    } catch (err) {
      console.error('Export failed:', err);
      setProgress('Export failed. Check console.');
      setTimeout(() => setProgress(''), 3000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={exportLocationsZip}
        disabled={exporting || !currentProjectId}
        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {exporting ? 'Exporting...' : 'Download Map Package'}
      </button>
      {progress && (
        <span className="text-sm text-slate-500">{progress}</span>
      )}
    </div>
  );
}
