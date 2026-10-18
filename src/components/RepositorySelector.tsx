'use client';

import React from 'react';
import { RepositorySummary } from '@/types';
import { GitFork, Layers, Calendar, ChevronRight } from 'lucide-react';

interface RepositorySelectorProps {
  repositories: RepositorySummary[];
  selectedRepoId: string | null;
  onSelectRepo: (repoId: string, snapshotId: string) => void;
  loading: boolean;
}

export function RepositorySelector({
  repositories,
  selectedRepoId,
  onSelectRepo,
  loading
}: RepositorySelectorProps) {
  if (loading) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4">
        <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          <div className="h-16 bg-zinc-800/60 rounded-lg animate-pulse" />
          <div className="h-16 bg-zinc-800/40 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-6 text-center">
        <GitFork className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
        <p className="text-sm font-medium text-zinc-300 mb-1">No repositories imported yet</p>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
          Import a public JavaScript/TypeScript GitHub repository above to construct its dependency graph in FalkorDB.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
          Imported Repositories ({repositories.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {repositories.map((item) => {
          const isSelected = item.repository.id === selectedRepoId;
          const snap = item.latestSnapshot;

          return (
            <button
              key={item.repository.id}
              onClick={() => {
                if (snap) {
                  onSelectRepo(item.repository.id, snap.id);
                }
              }}
              className={`flex flex-col text-left p-3.5 rounded-lg border transition-all cursor-pointer relative group ${
                isSelected
                  ? 'bg-zinc-800/90 border-emerald-500/60 shadow-sm shadow-emerald-500/10'
                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
              }`}
            >
              {/* Header: Name and Active Dot */}
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected ? 'bg-emerald-400' : 'bg-zinc-600'
                    }`}
                  />
                  <span className="font-mono text-sm font-semibold text-zinc-100 truncate">
                    {item.repository.owner}/{item.repository.name}
                  </span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 transition-transform shrink-0 ${
                    isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-zinc-600 group-hover:text-zinc-400'
                  }`}
                />
              </div>

              {/* Snapshot Stats */}
              {snap ? (
                <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono mt-1 pt-1 border-t border-zinc-800/60 w-full">
                  <div className="flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{snap.totalPackages} pkgs</span>
                  </div>
                  <span className="text-zinc-700">·</span>
                  <div className="text-[11px] text-zinc-500">
                    {snap.directCount} direct · {snap.transitiveCount} trans
                  </div>
                  <span className="text-zinc-700">·</span>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-500 ml-auto">
                    <Calendar className="w-3 h-3 text-zinc-600" />
                    <span>{new Date(snap.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic mt-1">No snapshot recorded</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
