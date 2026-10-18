'use client';

import React, { useState } from 'react';
import { InstallationNode } from '@/types';
import { Search, Package, ArrowRight, X } from 'lucide-react';

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
    <div className="bg-zinc-900/60 border border-zinc-800/90 rounded-xl flex flex-col min-h-[500px] lg:h-[calc(100vh-210px)] lg:max-h-[820px] shadow-sm overflow-hidden">
      {/* Header and Search */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/40 shrink-0">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300 font-mono">
            Installed Packages
          </span>
          <span className="text-xs font-mono text-zinc-400 font-medium px-2 py-0.5 rounded bg-zinc-850 border border-zinc-800">
            {filtered.length} / {packages.length}
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter packages by name or version..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/70 focus:ring-1 focus:ring-emerald-500/50 font-mono transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2 text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Package List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 p-1.5 space-y-0.5">
        {loading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-11 bg-zinc-800/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-mono">
            {searchTerm ? `No packages match "${searchTerm}"` : 'No packages found.'}
          </div>
        ) : (
          filtered.map((pkg) => {
            const isSelected = pkg.id === selectedInstallationId;

            return (
              <button
                key={pkg.id}
                onClick={() => onSelectPackage(pkg.id)}
                title={`${pkg.name}@${pkg.version}\nPath: ${pkg.packagePath}`}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-all cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 min-h-[42px] ${
                  isSelected
                    ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 shadow-sm'
                    : 'hover:bg-zinc-800/50 text-zinc-300 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <Package
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'
                    }`}
                  />
                  <div className="truncate">
                    <span className="font-mono text-xs font-semibold text-zinc-200 group-hover:text-white">
                      {pkg.name}
                    </span>
                    <span className="font-mono text-xs text-zinc-400 ml-1.5">
                      @{pkg.version}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {pkg.isDirect ? (
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-950/80 border border-emerald-800/80 text-emerald-300">
                      direct
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-mono text-zinc-400 bg-zinc-800/80 border border-zinc-700/60">
                      transitive
                    </span>
                  )}

                  {pkg.isDev ? (
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-zinc-400 bg-zinc-800/60">
                      dev
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono text-zinc-400 bg-zinc-800/60">
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
