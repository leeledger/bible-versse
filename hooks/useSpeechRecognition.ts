import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ISpeechRecognition, 
  ISpeechRecognitionEvent, 
  ISpeechRecognitionErrorEvent,
  ISpeechRecognitionStatic
} from '../types';

const getSpeechRecognition = (): ISpeechRecognitionStatic | undefined => {
  const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SpeechRecognitionConstructor;
};

interface UseSpeechRecognitionOptions {
  lang?: string;
}

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  browserSupportsSpeechRecognition: boolean;
  resetTranscript: () => void;
}

const useSpeechRecognition = (options?: UseSpeechRecognitionOptions): UseSpeechRecognitionReturn => {
  const SpeechRecognitionAPI = getSpeechRecognition();
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const browserSupportsSpeechRecognition = !!SpeechRecognitionAPI;
  const lang = options?.lang || 'ko-KR';

  // This ref will track if the stop was initiated by the user/app logic.
  const intentionalStopRef = useRef(false);

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setError('이 브라우저에서는 음성 인식을 지원하지 않습니다.');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let fullInterim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        fullInterim += event.results[i][0].transcript;
      }
      setTranscript(fullInterim);
      setError(null);
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error, event.message);
      let specificError = `오류: ${event.error}`;
      if (event.error === 'no-speech') specificError = '음성이 감지되지 않았습니다.';
      else if (event.error === 'audio-capture') specificError = '마이크를 찾을 수 없습니다.';
      else if (event.error === 'not-allowed') specificError = '마이크 사용이 차단되었습니다.';
      else if (event.error === 'network') specificError = '네트워크 오류입니다.';
      
      setError(specificError);
    };

    recognition.onend = () => {
      // The 'onend' event fires when recognition stops for any reason.
      // We check our ref to see if we stopped it intentionally.
      if (intentionalStopRef.current) {
        // If it was intentional, just update the state.
        setIsListening(false);
        intentionalStopRef.current = false; // Reset for next session
      } else if (recognitionRef.current) {
        // If it was NOT intentional (e.g., browser timeout on mobile),
        // and we still have a recognition instance, try to restart it immediately.
        try {
          recognitionRef.current.start();
          // We don't change isListening state, because we want it to seem continuous.
        } catch (e) {
          console.error('Error restarting speech recognition:', e);
          // If restart fails, then we update the state.
          setIsListening(false);
        }
      }
    };

    // Cleanup function for when the component unmounts.
    return () => {
      if (recognitionRef.current) {
        intentionalStopRef.current = true; // Ensure no restart on unmount
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [lang, browserSupportsSpeechRecognition, SpeechRecognitionAPI]);

  const startListening = useCallback(() => {
    if (isListening || !recognitionRef.current) {
      return;
    }
    try {
      // Mark that we are not stopping intentionally.
      intentionalStopRef.current = false;
      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
    } catch (e: any) {
      console.error('Error starting speech recognition:', e);
      setError(`마이크 시작 오류: ${e.message}`);
      setIsListening(false);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!isListening || !recognitionRef.current) {
      return;
    }
    try {
      // Mark that we ARE stopping intentionally.
      intentionalStopRef.current = true;
      recognitionRef.current.stop();
      // The onend event will handle setting isListening to false.
    } catch (e: any) {
      console.error('Error stopping speech recognition:', e);
      setError(`마이크 중지 오류: ${e.message}`);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return { isListening, transcript, error, startListening, stopListening, browserSupportsSpeechRecognition, resetTranscript };
};

export default useSpeechRecognition;
