import fs from 'fs/promises';
import path from 'path';
import type { CloneResult, CloneReport, CloneConfig } from '../domain/types.js';
import { logger } from '../utils/logger.js';

export class Reporter {
  private config: CloneConfig;

  constructor(config: CloneConfig) {
    this.config = config;
  }

  /**
   * Gera relatório completo (JSON + Markdown)
   */
  async generateReport(results: CloneResult[]): Promise<void> {
    await this.ensureOutputDir();

    const report = this.buildReport(results);

    // Gerar mapping.json
    await this.generateMappingJson(report);

    // Gerar report.md
    await this.generateMarkdownReport(report);

    logger.success(`Relatórios gerados em: ${this.config.outputDir}`);
  }

  /**
   * Constrói o objeto de relatório
   */
  private buildReport(results: CloneResult[]): CloneReport {
    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };

    return {
      cloned_at: new Date().toISOString(),
      source: {
        org_id: this.config.srcOrgId,
        project_id: this.config.srcProjectId,
      },
      destination: {
        org_id: this.config.dstOrgId,
        project_id: this.config.dstProjectId,
      },
      mappings: results,
      summary,
    };
  }

  /**
   * Gera mapping.json
   */
  private async generateMappingJson(report: CloneReport): Promise<void> {
    const filePath = path.join(this.config.outputDir, 'mapping.json');
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
    logger.info(`Mapping JSON gerado: ${filePath}`);
  }

  /**
   * Gera report.md
   */
  private async generateMarkdownReport(report: CloneReport): Promise<void> {
    const lines: string[] = [];

    // Header
    lines.push('# Clone Report');
    lines.push('');
    lines.push(`**Date:** ${new Date(report.cloned_at).toLocaleString()}`);
    lines.push(`**Source:** ${report.source.org_id || 'N/A'} / ${report.source.project_id || 'N/A'}`);
    lines.push(`**Destination:** ${report.destination.org_id || 'N/A'} / ${report.destination.project_id || 'N/A'}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`- ✅ Total: ${report.summary.total} assistants`);
    lines.push(`- ✅ Success: ${report.summary.success}`);
    lines.push(`- ❌ Failed: ${report.summary.failed}`);
    lines.push(`- ⏭️ Skipped: ${report.summary.skipped}`);
    lines.push('');

    // Details
    lines.push('## Details');
    lines.push('');

    for (const result of report.mappings) {
      const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
      lines.push(`### ${icon} ${result.name}`);
      lines.push('');
      lines.push(`- **Source ID:** ${result.srcId}`);
      if (result.dstId) {
        lines.push(`- **Destination ID:** ${result.dstId}`);
      }
      lines.push(`- **Status:** ${result.status}`);
      lines.push(`- **Assistant Operation:** ${result.operations.assistant}`);

      if (result.operations.file_search) {
        lines.push(`- **File Search:** ${result.operations.file_search}`);
      }

      if (result.operations.code_interpreter) {
        lines.push(`- **Code Interpreter:** ${result.operations.code_interpreter}`);
      }

      if (result.error) {
        lines.push(`- **Error:** ${result.error}`);
      }

      lines.push('');
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push(`Generated at ${new Date().toISOString()}`);

    const filePath = path.join(this.config.outputDir, 'report.md');
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
    logger.info(`Markdown report gerado: ${filePath}`);
  }

  /**
   * Garante que o diretório de saída existe
   */
  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
      logger.info(`Diretório de saída criado: ${this.config.outputDir}`);
    }
  }

  /**
   * Exibe resumo no console
   */
  static printSummary(results: CloneResult[]): void {
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('           CLONE SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total:    ${results.length}`);
    console.log(`Success:  ${success} ✅`);
    console.log(`Failed:   ${failed} ❌`);
    console.log(`Skipped:  ${skipped} ⏭️`);
    console.log('═══════════════════════════════════════');
    console.log('');
  }
}
