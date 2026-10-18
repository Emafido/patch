'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { IngestionBar } from '@/components/IngestionBar';
import { RepositorySelector } from '@/components/RepositorySelector';
import { PackageExplorer } from '@/components/PackageExplorer';
import { DependencyInvestigator } from '@/components/DependencyInvestigator';
import { 
  RepositorySummary, 
  InstallationNode, 
  InvestigationResult 
} from '@/types';
import { AlertTriangle, Bot, Sparkles, Download } from 'lucide-react';
import { AgentInvestigatorModal } from '@/components/AgentInvestigatorModal';
import type { AgentInvestigationResult } from '@/lib/agent/investigator';

export default function Home() {
  const [systemStatus, setSystemStatus] = useState<{
    connected: boolean;
    engineType: string;
    details: string;
    totalRepositories: number;
    activePortfolio: string;
  } | null>(null);

  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [reposLoading, setReposLoading] = useState(true);

  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);

  const [packages, setPackages] = useState<InstallationNode[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);

  // Remediation Agent State
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentResult, setAgentResult] = useState<AgentInvestigationResult | null>(null);

  const handleTriggerAgentInvestigation = async () => {
    setAgentLoading(true);
    setAgentModalOpen(true);
    try {
      const res = await fetch('/api/agent/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'Which shared dependency vulnerability should we investigate first, why is it present in these repositories, and what should we do about it?'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAgentResult(data.result || data);
      } else {
        const err = await res.json();
        console.error('Agent investigation error:', err);
      }
    } catch (e) {
      console.error('Failed to trigger agent investigation:', e);
    } finally {
      setAgentLoading(false);
    }
  };

  // Fetch System Status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  }, []);

  // Fetch Repositories
  const fetchRepositories = useCallback(async (selectTargetRepoId?: string, selectTargetSnapshotId?: string) => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/repositories');
      if (res.ok) {
        const data = await res.json();
        const list: RepositorySummary[] = data.repositories || [];
        setRepositories(list);

        if (selectTargetRepoId && selectTargetSnapshotId) {
          setSelectedRepoId(selectTargetRepoId);
          setSelectedSnapshotId(selectTargetSnapshotId);
        } else if (list.length > 0 && !selectedRepoId) {
          const first = list[0];
          if (first.latestSnapshot) {
            setSelectedRepoId(first.repository.id);
            setSelectedSnapshotId(first.latestSnapshot.id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch repositories:', e);
    } finally {
      setReposLoading(false);
    }
  }, [selectedRepoId]);

  // Fetch packages for the selected repository snapshot
  const fetchPackages = useCallback(async (repoId: string, snapshotId: string) => {
    setPackagesLoading(true);
    try {
      const res = await fetch(`/api/repositories/packages?repoId=${encodeURIComponent(repoId)}&snapshotId=${encodeURIComponent(snapshotId)}`);
      if (res.ok) {
        const data = await res.json();
        const pkgList: InstallationNode[] = data.packages || [];
        setPackages(pkgList);

        // Pre-select interesting package (prefer transitive 'postcss' or direct 'next' for demonstration)
        const targetPkg = pkgList.find(p => p.name === 'postcss') || pkgList.find(p => p.name === 'next') || pkgList[0];
        if (targetPkg) {
          setSelectedInstallationId(targetPkg.id);
        } else {
          setSelectedInstallationId(null);
          setInvestigation(null);
        }
      }
    } catch (e) {
      console.error('Failed to fetch packages:', e);
    } finally {
      setPackagesLoading(false);
    }
  }, []);

  // Fetch package investigation
  const fetchInvestigation = useCallback(async (installationId: string, snapshotId: string) => {
    setInvestigationLoading(true);
    try {
      const res = await fetch(`/api/packages/investigate?installationId=${encodeURIComponent(installationId)}&snapshotId=${encodeURIComponent(snapshotId)}`);
      if (res.ok) {
        const data = await res.json();
        setInvestigation(data.result);
      }
    } catch (e) {
      console.error('Failed to investigate package:', e);
    } finally {
      setInvestigationLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStatus();
    fetchRepositories();
  }, [fetchStatus, fetchRepositories]);

  // When selected repository/snapshot changes, load packages
  useEffect(() => {
    if (selectedRepoId && selectedSnapshotId) {
      fetchPackages(selectedRepoId, selectedSnapshotId);
    }
  }, [selectedRepoId, selectedSnapshotId, fetchPackages]);

  // When selected package changes, load investigation
  useEffect(() => {
    if (selectedInstallationId && selectedSnapshotId) {
      fetchInvestigation(selectedInstallationId, selectedSnapshotId);
    }
  }, [selectedInstallationId, selectedSnapshotId, fetchInvestigation]);

  // Handle successful import from IngestionBar
  const handleImportSuccess = (repoId: string, snapshotId: string) => {
    fetchStatus();
    fetchRepositories(repoId, snapshotId);
  };

  const handleSelectRepo = (repoId: string, snapshotId: string) => {
    setSelectedRepoId(repoId);
    setSelectedSnapshotId(snapshotId);
  };

  // Mobile view switcher ('packages' | 'investigation')
  const [mobileTab, setMobileTab] = useState<'packages' | 'investigation'>('packages');

  const handleSelectPackage = (installationId: string) => {
    setSelectedInstallationId(installationId);
    // On mobile screens, automatically switch to the investigation view when a package is selected
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileTab('investigation');
    }
  };

  const selectedRepo = repositories.find(r => r.repository.id === selectedRepoId);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Header systemStatus={systemStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5">
        {/* Ingestion Area */}
        <IngestionBar 
          onImportSuccess={handleImportSuccess} 
          hasRepositories={repositories.length > 0} 
        />

        {/* FalkorDB Disconnected Notice */}
        {systemStatus && !systemStatus.connected && (
          <div className="mb-5 p-4 rounded-xl border border-rose-800/80 bg-rose-950/40 text-rose-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-rose-100">FalkorDB Connection Required</h4>
                <p className="text-xs text-rose-300/90 leading-relaxed">
                  {systemStatus.details}
                </p>
                <div className="text-xs font-mono text-zinc-400 pt-1">
                  Configure <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300">.env.local</code> with your FalkorDB credentials:
                  <div className="mt-1 p-2.5 bg-zinc-950/90 rounded-lg border border-zinc-800 text-emerald-400 select-all font-mono text-xs">
                    FALKORDB_URL=falkor://falkordb:&lt;password&gt;@&lt;host&gt;:&lt;port&gt;
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repository Selector */}
        <RepositorySelector
          repositories={repositories}
          selectedRepoId={selectedRepoId}
          onSelectRepo={handleSelectRepo}
          loading={reposLoading}
        />

        {/* AI Remediation Agent Action Bar */}
        <div className="mb-5 p-3.5 sm:p-4 rounded-xl border border-emerald-900/50 bg-zinc-900/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">AI Remediation Intelligence</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-medium">
                  Track 1
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Traverse cross-repository transitive vulnerabilities in FalkorDB and generate prioritized fixes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {agentResult?.report && (
              <a
                href="/api/agent/report"
                download="patch-remediation-report.md"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Report (.md)
              </a>
            )}
            <button
              onClick={handleTriggerAgentInvestigation}
              disabled={agentLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {agentLoading ? 'Agent Traversing...' : 'Investigate Risks with AI Agent'}
            </button>
          </div>
        </div>

        {/* Core Investigation Workspace */}
        {selectedRepoId && selectedSnapshotId ? (
          <div className="space-y-3">
            {/* Mobile / Tablet View Switcher (visible only below lg) */}
            <div className="flex lg:hidden bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs font-mono">
              <button
                onClick={() => setMobileTab('packages')}
                className={`flex-1 py-2 text-center rounded-md font-medium transition-colors ${
                  mobileTab === 'packages'
                    ? 'bg-zinc-800 text-emerald-300 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Packages ({packages.length})
              </button>
              <button
                onClick={() => setMobileTab('investigation')}
                className={`flex-1 py-2 text-center rounded-md font-medium transition-colors ${
                  mobileTab === 'investigation'
                    ? 'bg-zinc-800 text-emerald-300 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Investigation {investigation ? `(${investigation.target.name})` : ''}
              </button>
            </div>

            {/* Two-Panel Investigation Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Installed Packages */}
              <div className={`lg:col-span-5 ${mobileTab === 'packages' ? 'block' : 'hidden lg:block'}`}>
                <PackageExplorer
                  packages={packages}
                  selectedInstallationId={selectedInstallationId}
                  onSelectPackage={handleSelectPackage}
                  loading={packagesLoading}
                />
              </div>

              {/* Right Column: Deep Dependency Investigation */}
              <div className={`lg:col-span-7 ${mobileTab === 'investigation' ? 'block' : 'hidden lg:block'}`}>
                <DependencyInvestigator
                  investigation={investigation}
                  loading={investigationLoading}
                />
              </div>
            </div>
          </div>
        ) : null}

        {/* AI Agent Modal */}
        <AgentInvestigatorModal
          isOpen={agentModalOpen}
          onClose={() => setAgentModalOpen(false)}
          result={agentResult}
          loading={agentLoading}
          onTriggerInvestigation={handleTriggerAgentInvestigation}
        />
      </main>
    </div>
  );
}
