'use client';

import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface IngestionBarProps {
  onImportSuccess: (repoId: string, snapshotId: string) => void;
  hasRepositories?: boolean;
}

const PRESET_FIXTURES = [
  { name: 'quikapi', url: 'https://github.com/Emafido/quikapi', label: 'QuikAPI (next → postcss)' },
  { name: 'ghost', url: 'https://github.com/Emafido/ghost', label: 'Ghost (axios / lucide)' },
  { name: 'ekotrace', url: 'https://github.com/Emafido/Ekotrace', label: 'Ekotrace (next / zod)' },
  { name: 'is', url: 'https://github.com/sindresorhus/is', label: 'sindresorhus/is (TS library)' }
];

export function IngestionBar({ onImportSuccess, hasRepositories = false }: IngestionBarProps) {
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
      setLoadingStage('Fetching package.json & package-lock.json from GitHub...');
      
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
    <div className={`bg-zinc-900/60 border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg shadow-black/20 transition-all ${hasRepositories ? 'mb-4' : 'mb-6'}`}>
      <div className="flex flex-col gap-3">
        {/* Label & Instructions */}
        <div className="flex items-center justify-between">
          <label htmlFor="repo-url-input" className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono flex items-center gap-1.5">
            <span>Import Repository to Graph</span>
          </label>
          <span className="text-xs font-mono text-zinc-500 hidden sm:inline">
            npm lockfile v2/v3 · direct & transitive
          </span>
        </div>

        {/* Input Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              id="repo-url-input"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="e.g. https://github.com/Emafido/quikapi or Emafido/quikapi"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-zinc-950/90 border border-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 transition-all font-mono"
            />
          </div>

          <button
            onClick={() => handleImport()}
            disabled={loading || !url.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-semibold text-sm transition-all shadow-sm shadow-emerald-500/20 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap min-h-[42px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
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
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 pt-1">
          <span className="flex items-center gap-1 font-mono text-xs text-zinc-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
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
              className="px-2.5 py-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 active:bg-zinc-800 border border-zinc-700/60 hover:border-emerald-500/50 text-zinc-200 hover:text-emerald-300 text-xs font-mono transition-all cursor-pointer disabled:opacity-50 min-h-[32px] flex items-center"
              title={`Click to import ${fixture.url}`}
            >
              {fixture.label}
            </button>
          ))}
        </div>

        {/* Live Loading Stage Indicator */}
        {loading && (
          <div className="flex items-center gap-2.5 text-xs text-emerald-400 font-mono mt-1 px-1 py-1 rounded bg-emerald-950/20 border border-emerald-900/40">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{loadingStage}</span>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs mt-1">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rose-200 mb-0.5">Import Error</p>
              <p className="font-mono text-xs leading-relaxed text-rose-200/90 break-words">{error}</p>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs mt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="font-mono text-xs text-emerald-200">{successMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}
