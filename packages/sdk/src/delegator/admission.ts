import { stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_ADMISSION } from './config.js';
import { ResourceSpec} from "@awcp/core";
import { minimatch } from 'minimatch'
import { relative } from 'node:path'

/**
 * Admission control configuration
 */
export interface AdmissionConfig {
  /** Maximum total bytes allowed */
  maxTotalBytes?: number;
  /** Maximum file count allowed */
  maxFileCount?: number;
  /** Maximum single file size */
  maxSingleFileBytes?: number;
  /** Custom check function for advanced validation */
  customCheck?: (localDir: string) => Promise<AdmissionResult>;
}

/**
 * Workspace statistics from admission scan
 */
export interface WorkspaceStats {
  estimatedBytes?: number;
  fileCount?: number;
  largestFileBytes?: number;
}

/**
 * Admission check result
 */
export interface AdmissionResult {
  allowed: boolean;
  stats?: WorkspaceStats;
  hint?: string;
}

/**
 * 检查文件是否应该被包含
 * @param filePath 文件相对路径（相对于工作目录）
 * @param resourceSpec 资源规格
 * @returns 是否包含该文件
 */
function shouldIncludeFile(filePath: string, resourceSpec: ResourceSpec): boolean {
  // 如果有 include 规则，检查是否匹配
  if (resourceSpec.include && resourceSpec.include.length > 0) {
    const isIncluded = resourceSpec.include.some(pattern => minimatch(filePath, pattern));
    if (!isIncluded) return false;
  }
  // 如果有 exclude 规则，检查是否匹配
  if (resourceSpec.exclude && resourceSpec.exclude.length > 0) {
    const isExcluded = resourceSpec.exclude.some(pattern => minimatch(filePath, pattern));
    if (isExcluded) return false;
  }
  // 如果没有 include 规则，默认包含所有文件
  return true;
}


/**
 * Performs preflight checks on workspace before allowing delegation.
 * Protects the system from oversized workspaces that could overwhelm
 * network or storage resources.
 */
export class AdmissionController {
  private config: AdmissionConfig;

  constructor(config?: AdmissionConfig) {
    this.config = config ?? {};
  }

  async check(localDir: string): Promise<AdmissionResult> {
    if (this.config.customCheck) {
      return this.config.customCheck(localDir);
    }

    try {
      const stats = await this.scanWorkspace(localDir);
      
      const maxTotal = this.config.maxTotalBytes ?? DEFAULT_ADMISSION.maxTotalBytes;
      const maxCount = this.config.maxFileCount ?? DEFAULT_ADMISSION.maxFileCount;
      const maxSingle = this.config.maxSingleFileBytes ?? DEFAULT_ADMISSION.maxSingleFileBytes;

      if (stats.estimatedBytes && stats.estimatedBytes > maxTotal) {
        return {
          allowed: false,
          stats,
          hint: `Workspace size (${this.formatBytes(stats.estimatedBytes)}) exceeds limit (${this.formatBytes(maxTotal)}). Consider selecting a smaller subdirectory.`,
        };
      }

      if (stats.fileCount && stats.fileCount > maxCount) {
        return {
          allowed: false,
          stats,
          hint: `File count (${stats.fileCount}) exceeds limit (${maxCount}). Consider excluding node_modules, build artifacts, or data directories.`,
        };
      }

      if (stats.largestFileBytes && stats.largestFileBytes > maxSingle) {
        return {
          allowed: false,
          stats,
          hint: `Largest file (${this.formatBytes(stats.largestFileBytes)}) exceeds limit (${this.formatBytes(maxSingle)}). Consider excluding large binary files.`,
        };
      }

      return { allowed: true, stats };
    } catch (error) {
      // Fail open for usability - real implementations may want to fail closed
      console.warn('[AWCP:Admission] Check failed, allowing by default:', error);
      return { allowed: true };
    }
  }

  private async scanWorkspace(localDir: string, resourceSpec?:ResourceSpec): Promise<WorkspaceStats> {
    let totalBytes = 0;
    let fileCount = 0;
    let largestFileBytes = 0;

    const scan = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = relative(localDir, fullPath);
        if (entry.isDirectory()) {
          // Skip directories that shouldn't be delegated
          if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
          }
          // skip the excluded file
          if (resourceSpec && !shouldIncludeFile(relativePath, resourceSpec)) {
            continue;
          }
          await scan(fullPath);
        } else if (entry.isFile()) {
          // skip the excluded file
          if (resourceSpec && !shouldIncludeFile(relativePath, resourceSpec)) {
            continue;
          }
          try {
            const fileStat = await stat(fullPath);
            const size = fileStat.size;
            totalBytes += size;
            fileCount++;
            if (size > largestFileBytes) {
              largestFileBytes = size;
            }
          } catch {
            // Skip files we can't stat (permission issues, etc.)
          }
        }
      }
    };

    await scan(localDir);

    return { estimatedBytes: totalBytes, fileCount, largestFileBytes };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
  }
}
