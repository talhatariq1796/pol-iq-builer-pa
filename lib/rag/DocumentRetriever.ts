/**
 * Document Retriever for RAG (Retrieval-Augmented Generation)
 *
 * Retrieves relevant documentation to augment AI responses with
 * accurate, sourced information about methodology and data.
 */

import { promises as fs } from 'fs';
import * as path from 'path';

export interface RAGDocument {
  id: string;
  title: string;
  path: string;
  category: 'methodology' | 'sources' | 'context' | 'reference';
  description: string;
  keywords: string[];
  use_when: string[];
  content?: string;
}

export interface CurrentIntelDocument {
  id: string;
  path: string;
  type: 'poll' | 'news' | 'analysis' | 'official' | 'upcoming';
  title: string;
  source: string;
  published: string;
  expires: string;
  relevance: string[];
  jurisdictions: string[];
  keywords: string[];
  priority: number;
  content?: string;
}

export interface CurrentIntelIndex {
  _metadata: {
    description: string;
    version: string;
    last_updated: string;
    update_frequency: string;
    notes: string;
  };
  sources: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    reliability: string;
    bias_rating: string;
    update_frequency: string;
  }>;
  documents: CurrentIntelDocument[];
  citation_keys: Record<string, { description: string; color_scheme: string }>;
}

export interface DataFileCitation {
  id: string;
  citation_key: string;
  description: string;
  source: string;
  use_for: string;
}

export interface DocumentIndex {
  _metadata: {
    description: string;
    version: string;
    created: string;
  };
  documents: RAGDocument[];
  data_files: DataFileCitation[];
}

export interface RetrievalResult {
  documents: RAGDocument[];
  citations: DataFileCitation[];
  currentIntel: CurrentIntelDocument[];
  context: string;
}

/**
 * DocumentRetriever - Finds and loads relevant documentation for RAG
 */
export class DocumentRetriever {
  private index: DocumentIndex | null = null;
  private currentIntelIndex: CurrentIntelIndex | null = null;
  private documentCache: Map<string, string> = new Map();
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /**
   * Initialize by loading the document index and current intel index
   */
  async initialize(): Promise<void> {
    const indexPath = path.join(this.basePath, 'data/rag/document-index.json');
    const intelIndexPath = path.join(this.basePath, 'data/rag/current-intel/intel-index.json');

    // Load main document index
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      this.index = JSON.parse(indexContent);
      console.log(
        `[DocumentRetriever] Loaded index with ${this.index?.documents.length} documents`
      );
    } catch (error) {
      console.error('[DocumentRetriever] Failed to load index:', error);
      // Create empty index as fallback
      this.index = {
        _metadata: { description: 'Fallback empty index', version: '0', created: '' },
        documents: [],
        data_files: [],
      };
    }

    // Load current intel index
    try {
      const intelContent = await fs.readFile(intelIndexPath, 'utf-8');
      this.currentIntelIndex = JSON.parse(intelContent);
      console.log(
        `[DocumentRetriever] Loaded current intel with ${this.currentIntelIndex?.documents.length} documents`
      );
    } catch (error) {
      console.error('[DocumentRetriever] Failed to load current intel index:', error);
      this.currentIntelIndex = null;
    }
  }

  /**
   * Find relevant documents for a query using keyword matching
   */
  findRelevantDocuments(query: string, maxDocs: number = 2): RAGDocument[] {
    if (!this.index) {
      console.warn('[DocumentRetriever] Index not loaded, call initialize() first');
      return [];
    }

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    // Score each document by keyword matches
    const scored = this.index.documents.map((doc) => {
      let score = 0;

      // Check keywords
      for (const keyword of doc.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 2;
        }
        // Partial match
        for (const word of queryWords) {
          if (keyword.toLowerCase().includes(word)) {
            score += 1;
          }
        }
      }

      // Check title
      if (queryLower.includes(doc.title.toLowerCase())) {
        score += 3;
      }

      // Check use_when conditions
      for (const condition of doc.use_when) {
        const conditionWords = condition.toLowerCase().split(/\s+/);
        const matchCount = conditionWords.filter((w) => queryLower.includes(w)).length;
        if (matchCount >= 2) {
          score += 2;
        }
      }

      return { doc, score };
    });

    // Sort by score and return top matches
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDocs)
      .map((s) => s.doc);
  }

  /**
   * Find relevant data file citations for a query
   */
  findRelevantCitations(query: string): DataFileCitation[] {
    if (!this.index) return [];

    const queryLower = query.toLowerCase();
    const relevant: DataFileCitation[] = [];

    for (const citation of this.index.data_files) {
      const descWords = citation.description.toLowerCase().split(/\s+/);
      const useForWords = citation.use_for.toLowerCase().split(/\s+/);

      // Check if query relates to this data file
      const matchDesc = descWords.some((w) => queryLower.includes(w) && w.length > 3);
      const matchUseFor = useForWords.some((w) => queryLower.includes(w) && w.length > 3);

      if (matchDesc || matchUseFor) {
        relevant.push(citation);
      }
    }

    return relevant;
  }

  /**
   * Find relevant current intel documents for a query
   * Filters out expired documents and scores by keyword/relevance match
   */
  findRelevantCurrentIntel(
    query: string,
    jurisdiction?: string,
    maxDocs: number = 3
  ): CurrentIntelDocument[] {
    if (!this.currentIntelIndex) return [];

    const now = new Date();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

    // Filter out expired documents and score remaining
    const scored = this.currentIntelIndex.documents
      .filter((doc) => new Date(doc.expires) > now)
      .map((doc) => {
        let score = 0;

        // Check keywords (highest weight)
        for (const keyword of doc.keywords) {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 3;
          }
          // Partial match
          for (const word of queryWords) {
            if (keyword.toLowerCase().includes(word)) {
              score += 1;
            }
          }
        }

        // Check relevance tags
        for (const tag of doc.relevance) {
          if (queryLower.includes(tag.toLowerCase())) {
            score += 2;
          }
        }

        // Check title
        const titleWords = doc.title.toLowerCase().split(/\s+/);
        for (const word of queryWords) {
          if (titleWords.some((tw) => tw.includes(word))) {
            score += 2;
          }
        }

        // Jurisdiction boost - boost docs that match the query's jurisdiction
        if (jurisdiction && doc.jurisdictions.length > 0) {
          if (doc.jurisdictions.some((j) => j.toLowerCase().includes(jurisdiction.toLowerCase()))) {
            score += 5; // Strong boost for local relevance
          }
        }

        // Priority boost (1 = highest priority)
        score += (4 - doc.priority);

        // Type-specific boosts for certain query patterns
        if (doc.type === 'upcoming' && (queryLower.includes('2026') || queryLower.includes('upcoming') || queryLower.includes('next'))) {
          score += 3;
        }
        if (doc.type === 'poll' && (queryLower.includes('poll') || queryLower.includes('survey'))) {
          score += 3;
        }

        return { doc, score };
      });

    // Sort by score and return top matches
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxDocs)
      .map((s) => s.doc);
  }

  /**
   * Load current intel document content from file
   */
  async loadCurrentIntelContent(doc: CurrentIntelDocument): Promise<string> {
    // Check cache first
    if (this.documentCache.has(doc.id)) {
      return this.documentCache.get(doc.id)!;
    }

    const fullPath = path.join(this.basePath, doc.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      // Strip YAML frontmatter for cleaner output
      const stripped = content.replace(/^---[\s\S]*?---\n+/, '');
      this.documentCache.set(doc.id, stripped);
      return stripped;
    } catch (error) {
      console.error(`[DocumentRetriever] Failed to load intel ${doc.path}:`, error);
      return `[Intel document "${doc.title}" could not be loaded]`;
    }
  }

  /**
   * Load document content from file
   */
  async loadDocumentContent(doc: RAGDocument): Promise<string> {
    // Check cache first
    if (this.documentCache.has(doc.id)) {
      return this.documentCache.get(doc.id)!;
    }

    const fullPath = path.join(this.basePath, doc.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      this.documentCache.set(doc.id, content);
      return content;
    } catch (error) {
      console.error(`[DocumentRetriever] Failed to load ${doc.path}:`, error);
      return `[Document "${doc.title}" could not be loaded]`;
    }
  }

  /**
   * Get retrieval result for a query - documents + current intel + formatted context
   */
  async retrieve(
    query: string,
    options: {
      maxDocs?: number;
      maxIntel?: number;
      jurisdiction?: string;
    } = {}
  ): Promise<RetrievalResult> {
    await this.ensureInitialized();

    const { maxDocs = 2, maxIntel = 3, jurisdiction } = options;

    const documents = this.findRelevantDocuments(query, maxDocs);
    const citations = this.findRelevantCitations(query);
    const currentIntel = this.findRelevantCurrentIntel(query, jurisdiction, maxIntel);

    // Load content for matched documents
    const contentParts: string[] = [];

    for (const doc of documents) {
      const content = await this.loadDocumentContent(doc);
      contentParts.push(`## ${doc.title}\n\n${content}`);
    }

    // Add current intel section
    if (currentIntel.length > 0) {
      contentParts.push('\n## Current Intelligence\n');
      contentParts.push('*Recent news, polls, and analysis relevant to the query:*\n');

      for (const intel of currentIntel) {
        const content = await this.loadCurrentIntelContent(intel);
        const typeLabel = this.getIntelTypeLabel(intel.type);
        contentParts.push(`### ${typeLabel} ${intel.title}\n`);
        contentParts.push(`*Source: ${intel.source} | Published: ${intel.published}*\n`);
        contentParts.push(content);
      }
    }

    // Add citation reference section
    if (citations.length > 0) {
      contentParts.push('\n## Available Data Sources\n');
      for (const citation of citations) {
        contentParts.push(
          `- ${citation.citation_key} ${citation.description} (Source: ${citation.source})`
        );
      }
    }

    return {
      documents,
      citations,
      currentIntel,
      context: contentParts.join('\n\n'),
    };
  }

  /**
   * Get display label for intel type
   */
  private getIntelTypeLabel(type: CurrentIntelDocument['type']): string {
    const labels: Record<CurrentIntelDocument['type'], string> = {
      poll: '[POLL]',
      news: '[NEWS]',
      analysis: '[ANALYSIS]',
      official: '[OFFICIAL]',
      upcoming: '[UPCOMING]',
    };
    return labels[type] || `[${type.toUpperCase()}]`;
  }

  /**
   * Ensure index is loaded
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.index) {
      await this.initialize();
    }
  }

  /**
   * Get all available citation keys for the system prompt
   */
  getCitationKeys(): string[] {
    if (!this.index) return [];
    return this.index.data_files.map((f) => f.citation_key);
  }

  /**
   * Format context for Claude's system prompt
   */
  formatForSystemPrompt(retrievalResult: RetrievalResult): string {
    if (!retrievalResult.context) {
      return '';
    }

    // Build citation key list from both data files and intel types
    const dataFileCitations = this.index?.data_files.map((f) => `- ${f.citation_key}: ${f.description}`).join('\n') || '';
    const intelCitations = this.currentIntelIndex?.citation_keys
      ? Object.entries(this.currentIntelIndex.citation_keys)
          .map(([key, info]) => `- ${key}: ${info.description}`)
          .join('\n')
      : '';

    return `
## Reference Documentation

The following documentation is relevant to the user's query. Use this information to provide accurate, sourced responses.

${retrievalResult.context}

## Citation Instructions

When making factual claims, cite your sources using these keys:

**Data Sources:**
${dataFileCitations}

**Current Intelligence:**
${intelCitations}

Format citations inline, e.g., "Turnout was 72% [ELECTIONS]" or "According to recent polling [POLL]".
When referencing upcoming elections or candidates, use [UPCOMING].
`;
  }

  /**
   * Get all available citation keys (both data files and intel)
   */
  getAllCitationKeys(): string[] {
    const keys: string[] = [];

    if (this.index) {
      keys.push(...this.index.data_files.map((f) => f.citation_key));
    }

    if (this.currentIntelIndex?.citation_keys) {
      keys.push(...Object.keys(this.currentIntelIndex.citation_keys));
    }

    return keys;
  }
}

// Singleton instance
let retrieverInstance: DocumentRetriever | null = null;

export function getDocumentRetriever(): DocumentRetriever {
  if (!retrieverInstance) {
    retrieverInstance = new DocumentRetriever();
  }
  return retrieverInstance;
}

export default DocumentRetriever;
