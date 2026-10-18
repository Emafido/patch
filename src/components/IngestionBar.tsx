'use client';

import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface IngestionBarProps {
  onImportSuccess: (repoId: string, snapshotId: string) => void;
}

const PRESET_FIXTURES = [
  { name: 'quikapi', url: 'https://github.com/Emafido/quikapi', label: 'QuikAPI (next → postcss)' },
  { name: 'ghost', url: 'https://github.com/Emafido/ghost', label: 'Ghost (axios / lucide)' },
  { name: 'ekotrace', url: 'https://github.com/Emafido/Ekotrace', label: 'Ekotrace (next / zod)' },
  { name: 'is', url: 'https://github.com/sindresorhus/is', label: 'sindresorhus/is (TS library)' }
];

export function IngestionBar({ onImportSuccess }: IngestionBarProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleImport = async (targetUrl?: string) => {
    const inputUrl = (targetUrl || url).trim();
    if (!inputUrl) {
      setError('Please enter a GitHub repository URL.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setLoadingStage('Validating repository URL...');

    try {
      setLoadingStage('Fetching package.json & package-lock.json...');
      
      const res = await fetch('/api/repositories/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import repository.');
      }

      setLoadingStage('Constructing FalkorDB dependency graph...');
      setSuccessMsg(data.message || 'Repository successfully imported!');
      setUrl('');
      onImportSuccess(data.repository.id, data.snapshot.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleImport();
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 mb-8 shadow-lg shadow-black/20">
      <div className="flex flex-col gap-3">
        {/* Input Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Enter public GitHub repository URL (e.g. https://github.com/Emafido/quikapi)"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 transition-all font-mono"
            />
          </div>

          <button
            onClick={() => handleImport()}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold text-sm transition-all shadow-sm shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-900" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <span>Import Repository</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Quick Test Fixture Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 pt-1">
          <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            Quick Test Fixtures:
          </span>
          {PRESET_FIXTURES.map((fixture) => (
            <button
              key={fixture.name}
              onClick={() => {
                setUrl(fixture.url);
                handleImport(fixture.url);
              }}
              disabled={loading}
              className="px-2.5 py-1 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/50 hover:border-emerald-500/40 text-zinc-300 hover:text-emerald-300 text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
              title={`Import ${fixture.url}`}
            >
              {fixture.label}
            </button>
          ))}
        </div>

        {/* Live Loading Stage Indicator */}
        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-emerald-400 font-mono mt-1 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{loadingStage}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs mt-1">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-0.5">Import Error</p>
              <p className="font-mono text-[11px] leading-relaxed text-rose-200/90">{error}</p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs mt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="font-mono text-[11px] text-emerald-200">{successMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
