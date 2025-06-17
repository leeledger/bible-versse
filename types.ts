export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// Represents progress within a single reading session
export interface SessionReadingProgress {
  totalVersesInSession: number; // Total number of verses in this session's goal
  sessionCompletedVersesCount: number; // Verses completed *in this session* (from start of selection, including skipped)
  sessionInitialSkipCount: number; // Number of verses skipped at the beginning of this session
}

export enum ReadingState {
  IDLE = "IDLE", // Or "CHAPTER_SELECTION"
  READING = "READING",
  LISTENING = "LISTENING",
  PROCESSING = "PROCESSING", // Not actively used but kept for potential future
  SESSION_COMPLETED = "SESSION_COMPLETED", // Current reading session's selection completed
  ERROR = "ERROR",
}

export interface User {
  id?: number; // Optional: as it might not be available immediately or in all contexts
  username: string;
  must_change_password?: boolean; // Optional: To indicate if user needs to change password
}

// Stores the user's overall last read point ("bookmark")
export interface UserProgress {
  lastReadBook: string;
  lastReadChapter: number;
  lastReadVerse: number;
  history?: UserSessionRecord[];
  completedChapters?: string[]; // Array of strings like "BookName:ChapterNum"
  lastProgressUpdateDate?: string; // ISO string format for when progress was last saved
}

export interface UserSessionRecord {
  date: string;
  book: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
  versesRead: number; // Verses *actually* read in this session
}


// Web Speech API minimal type definitions (remains the same)
export interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}

export interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

export interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

export type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'aborted'
  | string;


export interface ISpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
}

export interface ISpeechRecognition extends EventTarget {
  grammars: any; 
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  start(): void;
  stop(): void;
  abort(): void;

  onaudiostart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => any) | null;
  onnomatch: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
}

export interface ISpeechRecognitionStatic {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionStatic;
    webkitSpeechRecognition?: ISpeechRecognitionStatic;
  }
}

// For chapter selection
export interface BookChapterInfo {
  name: string;
  chapterCount: number;
  versesPerChapter: number[]; // versesPerChapter[0] is for chapter 1
}