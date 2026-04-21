import { useState, Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface GeoProcessingStep {
  id: string;
  name: string;
  status: 'processing' | 'complete' | 'error';
  message?: string;
}

export interface DebugInfo {
  [key: string]: any;
}

export interface ChatState {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: Dispatch<SetStateAction<boolean>>;
  processingSteps: GeoProcessingStep[];
  setProcessingSteps: Dispatch<SetStateAction<GeoProcessingStep[]>>;
  currentProcessingStep: string | null;
  setCurrentProcessingStep: Dispatch<SetStateAction<string | null>>;
  replyMessage: ChatMessage | null;
  setReplyMessage: Dispatch<SetStateAction<ChatMessage | null>>;
  isReplyDialogOpen: boolean;
  setIsReplyDialogOpen: Dispatch<SetStateAction<boolean>>;
}

export const useChatState = (): ChatState => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<GeoProcessingStep[]>([]);
  const [currentProcessingStep, setCurrentProcessingStep] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState<ChatMessage | null>(null);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);

  return {
    messages,
    setMessages,
    input,
    setInput,
    isProcessing,
    setIsProcessing,
    processingSteps,
    setProcessingSteps,
    currentProcessingStep,
    setCurrentProcessingStep,
    replyMessage,
    setReplyMessage,
    isReplyDialogOpen,
    setIsReplyDialogOpen,
  };
}; 