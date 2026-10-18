import * as React from 'react';

export interface LucideProps extends React.SVGProps<SVGSVGElement> {
  size?: string | number;
  color?: string;
  strokeWidth?: string | number;
  className?: string;
}

export type Icon = React.FC<LucideProps>;

export const Shield: Icon;
export const GitBranch: Icon;
export const Layers: Icon;
export const Database: Icon;
export const ExternalLink: Icon;
export const AlertTriangle: Icon;
export const CheckCircle2: Icon;
export const RefreshCw: Icon;
export const Search: Icon;
export const ArrowRight: Icon;
export const GitFork: Icon;
export const Box: Icon;
export const Server: Icon;
export const Info: Icon;
export const Check: Icon;
export const Clock: Icon;
export const AlertCircle: Icon;
export const ChevronRight: Icon;
export const ChevronDown: Icon;
export const CornerDownRight: Icon;
export const Filter: Icon;
export const Sparkles: Icon;
export const X: Icon;
export const ArrowUpRight: Icon;
export const HardDrive: Icon;
export const Network: Icon;
export const Cpu: Icon;
export const GitCommit: Icon;
export const FolderGit2: Icon;
export const Play: Icon;
export const Terminal: Icon;
export const Share2: Icon;
export const Package: Icon;
export const Loader2: Icon;
export const Calendar: Icon;

export type LucideIcon = Icon;
export default icons;
declare const icons: Record<string, Icon>;
