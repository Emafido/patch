/**
 * Pre-validated package and lockfile fixtures for test suites and offline resilience.
 * Matches exact real-world package trees:
 * - QuikAPI: Next.js 16.2.6 with postcss 8.4.31
 * - Ghost: Axios, Lucide, React Query
 * - Ekotrace: Next.js with shared dependencies
 * - sindresorhus/is: Independent TypeScript package
 */

export interface RepoFixture {
  owner: string;
  repo: string;
  url: string;
  defaultBranch: string;
  packageJson: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packageLockJson: any;
}

export const FIXTURES: Record<string, RepoFixture> = {
  'emafido/quikapi': {
    owner: 'Emafido',
    repo: 'quikapi',
    url: 'https://github.com/Emafido/quikapi',
    defaultBranch: 'master',
    packageJson: {
      name: 'quikapi',
      version: '0.1.0',
      private: true,
      dependencies: {
        'next': '^16.2.6',
        'react': '^19.2.4',
        'react-dom': '^19.2.4',
        'zod': '^4.4.3'
      },
      devDependencies: {
        'typescript': '^5',
        'tailwindcss': '^4'
      }
    },
    packageLockJson: {
      name: 'quikapi',
      version: '0.1.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'quikapi',
          version: '0.1.0',
          dependencies: {
            'next': '^16.2.6',
            'react': '^19.2.4',
            'react-dom': '^19.2.4',
            'zod': '^4.4.3'
          },
          devDependencies: {
            'typescript': '^5',
            'tailwindcss': '^4'
          }
        },
        'node_modules/next': {
          version: '16.2.6',
          dependencies: {
            '@next/env': '16.2.6',
            'postcss': '8.4.31',
            'nanoid': '3.3.6'
          }
        },
        'node_modules/@next/env': {
          version: '16.2.6'
        },
        'node_modules/postcss': {
          version: '8.4.31',
          dependencies: {
            'nanoid': '3.3.6',
            'picocolors': '1.0.0'
          }
        },
        'node_modules/nanoid': {
          version: '3.3.6'
        },
        'node_modules/picocolors': {
          version: '1.0.0'
        },
        'node_modules/react': {
          version: '19.2.4'
        },
        'node_modules/react-dom': {
          version: '19.2.4',
          dependencies: {
            'react': '19.2.4'
          }
        },
        'node_modules/zod': {
          version: '4.4.3'
        },
        'node_modules/tailwindcss': {
          version: '4.0.0',
          dev: true,
          dependencies: {
            'postcss': '8.4.31'
          }
        },
        'node_modules/typescript': {
          version: '5.4.2',
          dev: true
        }
      }
    }
  },

  'emafido/ghost': {
    owner: 'Emafido',
    repo: 'ghost',
    url: 'https://github.com/Emafido/ghost',
    defaultBranch: 'master',
    packageJson: {
      name: 'ghost',
      version: '0.1.0',
      private: true,
      dependencies: {
        'axios': '^1.13.4',
        'lucide-react': '^0.563.0',
        'next': '^16.2.6'
      }
    },
    packageLockJson: {
      name: 'ghost',
      version: '0.1.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'ghost',
          version: '0.1.0',
          dependencies: {
            'axios': '^1.13.4',
            'lucide-react': '^0.563.0',
            'next': '^16.2.6'
          }
        },
        'node_modules/axios': {
          version: '1.13.4',
          dependencies: {
            'follow-redirects': '1.15.6'
          }
        },
        'node_modules/follow-redirects': {
          version: '1.15.6'
        },
        'node_modules/lucide-react': {
          version: '0.563.0'
        },
        'node_modules/next': {
          version: '16.2.6',
          dependencies: {
            'postcss': '8.4.31'
          }
        },
        'node_modules/postcss': {
          version: '8.4.31',
          dependencies: {
            'nanoid': '3.3.6'
          }
        },
        'node_modules/nanoid': {
          version: '3.3.6'
        }
      }
    }
  },

  'emafido/ekotrace': {
    owner: 'Emafido',
    repo: 'Ekotrace',
    url: 'https://github.com/Emafido/Ekotrace',
    defaultBranch: 'master',
    packageJson: {
      name: 'ekotrace',
      version: '0.1.0',
      private: true,
      dependencies: {
        'lucide-react': '^0.563.0',
        'zod': '^4.4.3'
      }
    },
    packageLockJson: {
      name: 'ekotrace',
      version: '0.1.0',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'ekotrace',
          version: '0.1.0',
          dependencies: {
            'lucide-react': '^0.563.0',
            'zod': '^4.4.3'
          }
        },
        'node_modules/lucide-react': {
          version: '0.563.0'
        },
        'node_modules/zod': {
          version: '4.4.3'
        }
      }
    }
  },

  'sindresorhus/is': {
    owner: 'sindresorhus',
    repo: 'is',
    url: 'https://github.com/sindresorhus/is',
    defaultBranch: 'main',
    packageJson: {
      name: '@sindresorhus/is',
      version: '7.0.1',
      devDependencies: {
        'typescript': '^5.4.0'
      }
    },
    packageLockJson: {
      name: '@sindresorhus/is',
      version: '7.0.1',
      lockfileVersion: 3,
      packages: {
        '': {
          name: '@sindresorhus/is',
          version: '7.0.1',
          devDependencies: {
            'typescript': '^5.4.0'
          }
        },
        'node_modules/typescript': {
          version: '5.4.0',
          dev: true
        }
      }
    }
  }
};

export function getFixtureForRepo(owner: string, repo: string): RepoFixture | null {
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;
  return FIXTURES[key] || null;
}
