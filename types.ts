export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// Represents progress within a single reading session
export interface SessionReadingProgress {
  currentBook: string; // Book of the current verse being targeted in the session
  currentChapter: number; // Chapter of the current verse being targeted
  currentVerseNum: number; // Verse number of the current verse being targeted
  
  // About the session's overall goal
  sessionTargetVerses: BibleVerse[]; // All verses targeted in this specific session
  sessionTotalVersesCount: number; // Total number of verses in this session's goal
  sessionCompletedVersesCount: number; // Verses completed *in this session* (from start of selection, including skipped)
  
  sessionTargetChapters: { book: string; chapter: number; totalVerses: number }[]; // Chapters included in this session
  sessionCompletedChaptersCount: number; // Chapters completed *in this session*
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
  username: string;
}

// Stores the user's overall last read point ("bookmark")
export interface UserProgress {
  lastReadBook: string;
  lastReadChapter: number;
  lastReadVerse: number;
  history?: UserSessionRecord[]; // Optional: for more detailed history
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