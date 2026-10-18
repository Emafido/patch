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

  const handleSelectPackage = (installationId: string) => {
    setSelectedInstallationId(installationId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <Header systemStatus={systemStatus} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Ingestion Area */}
        <IngestionBar onImportSuccess={handleImportSuccess} />

        {/* Repository Selector */}
        <div className="mb-6">
          <RepositorySelector
            repositories={repositories}
            selectedRepoId={selectedRepoId}
            onSelectRepo={handleSelectRepo}
            loading={reposLoading}
          />
        </div>

        {/* Core Investigation Workspace */}
        {selectedRepoId && selectedSnapshotId ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Installed Packages */}
            <div className="lg:col-span-5">
              <PackageExplorer
                packages={packages}
                selectedInstallationId={selectedInstallationId}
                onSelectPackage={handleSelectPackage}
                loading={packagesLoading}
              />
            </div>

            {/* Right Column: Deep Dependency Investigation */}
            <div className="lg:col-span-7">
              <DependencyInvestigator
                investigation={investigation}
                loading={investigationLoading}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
