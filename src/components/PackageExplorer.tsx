'use client';

import React, { useState } from 'react';
import { InstallationNode } from '@/types';
import { Search, Package, ArrowRight } from 'lucide-react';

interface PackageExplorerProps {
  packages: InstallationNode[];
  selectedInstallationId: string | null;
  onSelectPackage: (installationId: string) => void;
  loading: boolean;
}

export function PackageExplorer({
  packages,
  selectedInstallationId,
  onSelectPackage,
  loading
}: PackageExplorerProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = packages.filter((pkg) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return pkg.name.toLowerCase().includes(q) || pkg.version.includes(q);
  });

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col h-[650px] shadow-sm">
      {/* Header and Search */}
      <div className="p-3.5 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Installed Packages
          </span>
          <span className="text-xs font-mono text-zinc-500">
            {filtered.length} / {packages.length}
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by package name or version..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50 font-mono"
          />
        </div>
      </div>

      {/* Package List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 p-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 bg-zinc-800/40 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs">
            {searchTerm ? `No packages match "${searchTerm}"` : 'No packages found.'}
          </div>
        ) : (
          filtered.map((pkg) => {
            const isSelected = pkg.id === selectedInstallationId;

            return (
              <button
                key={pkg.id}
                onClick={() => onSelectPackage(pkg.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-emerald-950/30 border border-emerald-500/40 text-emerald-200 shadow-sm'
                    : 'hover:bg-zinc-800/50 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <Package
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  />
                  <div className="truncate">
                    <span className="font-mono text-xs font-medium text-zinc-200 group-hover:text-white">
                      {pkg.name}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 ml-1.5">
                      @{pkg.version}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {pkg.isDirect ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/70 border border-emerald-800/60 text-emerald-300">
                      direct
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-500 bg-zinc-800/60 border border-zinc-700/40">
                      transitive
                    </span>
                  )}

                  {pkg.isDev ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800/40">
                      dev
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-800/40">
                      prod
                    </span>
                  )}

                  <ArrowRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-transparent group-hover:text-zinc-500'
                    }`}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
