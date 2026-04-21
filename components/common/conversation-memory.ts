export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Optional persona label associated with the message (e.g. strategist) */
  persona?: string;
  /** Optional analysis type metadata for assistant responses */
  analysisType?: string;
}

export interface SummarizedMemory {
  summary: string;
  tokens: number;
  lastUpdated: number;
}

export class ConversationMemory {
  private messages: MemoryMessage[] = [];
  private summaries: SummarizedMemory[] = [];
  private readonly maxMessages: number;
  private readonly summarizeThreshold: number;
  
  constructor(options: {
    maxMessages?: number;
    summarizeThreshold?: number;
    initialMessages?: MemoryMessage[];
    initialSummaries?: SummarizedMemory[];
  } = {}) {
    this.maxMessages = options.maxMessages || 50;
    this.summarizeThreshold = options.summarizeThreshold || 10;
    this.messages = options.initialMessages || [];
    this.summaries = options.initialSummaries || [];
  }
  
  /**
   * Add a new message to memory. 2-arg form lets callers provide a separate
   * `persona` string for backward-compatibility with older tests.
   */
  public addMessage(
    message: Omit<MemoryMessage, 'timestamp' | 'persona'> & Partial<Pick<MemoryMessage, 'analysisType'>>, 
    persona?: string
  ): void {
    const newMessage: MemoryMessage = {
      ...message,
      timestamp: Date.now(),
      ...(persona ? { persona } : {}),
    } as MemoryMessage;
    
    this.messages.push(newMessage);
    
    // Check if we need to summarize
    if (this.messages.length >= this.summarizeThreshold) {
      this.triggerSummarization();
    }
    
    // Prune if we have more than max messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(this.messages.length - this.maxMessages);
    }
  }
  
  /**
   * Get all messages currently in memory
   */
  public getMessages(): MemoryMessage[] {
    return [...this.messages];
  }
  
  /**
   * Get the most recent n messages
   */
  public getRecentMessages(count: number): MemoryMessage[] {
    return this.messages.slice(-count);
  }
  
  /**
   * Get current summaries
   */
  public getSummaries(): SummarizedMemory[] {
    return [...this.summaries];
  }
  
  /**
   * Get a formatted context that combines summaries and recent messages
   */
  public getFormattedContext(options: {
    maxTokens?: number;
    recentMessagesCount?: number;
  } = {}): string {
    const { maxTokens = 1000, recentMessagesCount = 5 } = options;
    
    let context = '';
    let estimatedTokens = 0;
    
    // Add summaries, newest first
    for (const summary of this.summaries.slice().reverse()) {
      // Simple token estimation (4 chars ~= 1 token)
      const summaryTokens = summary.tokens || Math.ceil(summary.summary.length / 4);
      
      if (estimatedTokens + summaryTokens <= maxTokens) {
        context += `Conversation summary: ${summary.summary}\n\n`;
        estimatedTokens += summaryTokens;
      } else {
        break;
      }
    }
    
    // Add most recent messages
    const recentMessages = this.getRecentMessages(recentMessagesCount);
    context += 'Recent messages:\n';
    
    for (const message of recentMessages) {
      const messageText = `${message.role}: ${message.content}\n`;
      const messageTokens = Math.ceil(messageText.length / 4);
      
      if (estimatedTokens + messageTokens <= maxTokens) {
        context += messageText;
        estimatedTokens += messageTokens;
      } else {
        break;
      }
    }
    
    return context.trim();
  }
  
  /**
   * Clear all messages and summaries
   */
  public clear(): void {
    this.messages = [];
    this.summaries = [];
  }
  
  /**
   * Export the memory state for persistence
   */
  public export(): { messages: MemoryMessage[]; summaries: SummarizedMemory[] } {
    return {
      messages: this.messages,
      summaries: this.summaries
    };
  }
  
  /**
   * Import a previously exported memory state
   */
  public import(data: { messages: MemoryMessage[]; summaries: SummarizedMemory[] }): void {
    this.messages = data.messages || [];
    this.summaries = data.summaries || [];
  }
  
  /**
   * Add a pre-generated summary
   */
  public addSummary(summary: string, tokens: number = 0): void {
    this.summaries.push({
      summary,
      tokens: tokens || Math.ceil(summary.length / 4),
      lastUpdated: Date.now()
    });
  }
  
  /**
   * Trigger the summarization process
   * In a real app, this would call your AI service
   */
  private async triggerSummarization(): Promise<void> {
    // In a production app, this would actually call your API
    // For now, we'll just simulate by creating a simple summary 
    
    const messagesToSummarize = this.messages.slice(0, this.summarizeThreshold);
    
    // Create a simple summary
    const topics = new Set<string>();
    let userQuestions = 0;
    let aiResponses = 0;
    
    for (const message of messagesToSummarize) {
      if (message.role === 'user') {
        userQuestions++;
        // Extract potential topics (naive approach)
        const words = message.content.split(' ');
        for (const word of words) {
          if (word.length > 5) {
            topics.add(word.toLowerCase());
          }
        }
      } else if (message.role === 'assistant') {
        aiResponses++;
      }
    }
    
    const topicsList = Array.from(topics).slice(0, 3).join(', ');
    
    const summary = `This conversation contains ${userQuestions} user questions and ${aiResponses} assistant responses. Topics discussed include: ${topicsList}.`;
    
    // Add the summary
    this.addSummary(summary);
    
    // Remove summarized messages from active memory
    this.messages = this.messages.slice(this.summarizeThreshold);
  }

  /** Deprecated alias retained for unit-tests */
  public clearSession(): void {
    this.clear();
  }
} 