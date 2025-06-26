import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

  // iOS 기기 감지
  const isIOS = useMemo(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  // This ref will track if the stop was initiated by the user/app logic.
  const intentionalStopRef = useRef(false);
  
  // iOS 기기에서만 사용할 최종 트랜스크립트와 이전 임시 결과를 저장할 ref
  const finalTranscriptRef = useRef('');
  const lastInterimRef = useRef('');
  
  // iOS에서 절 변경 시 늦게 도착하는 인식 결과를 무시하기 위한 플래그
  const ignoreResultsRef = useRef(false);

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
      // iOS에서 ignoreResultsRef가 true면 결과 무시
      if (isIOS && ignoreResultsRef.current) {
        console.log('[useSpeechRecognition] iOS - Ignoring results during transition');
        return;
      }

      let interimTranscript = '';
      let finalTranscript = '';
      let hasFinalResult = false;

      // Combine all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalTranscript += transcript;
          hasFinalResult = true;
        } else {
          interimTranscript += transcript;
        }
      }

      console.log(`[useSpeechRecognition] onresult - hasFinal: ${hasFinalResult}, final: "${finalTranscript}", interim: "${interimTranscript}"`);

      // iOS에서는 finalTranscript와 interimTranscript를 분리하여 처리
      if (isIOS) {
        if (hasFinalResult) {
          // Final 결과가 있을 때만 finalTranscriptRef 업데이트
          finalTranscriptRef.current += finalTranscript;
          lastInterimRef.current = '';
          console.log('[useSpeechRecognition] iOS - Final update:', finalTranscriptRef.current);
        } 
        
        // 항상 현재 트랜스크립트 업데이트 (final + interim)
        const newTranscript = finalTranscriptRef.current + interimTranscript;
        setTranscript(newTranscript);
        
        // Interim 결과가 있으면 lastInterimRef 업데이트
        if (interimTranscript) {
          lastInterimRef.current = interimTranscript;
          console.log('[useSpeechRecognition] iOS - Interim update:', interimTranscript);
        }
      } 
      // 안드로이드 등의 다른 기기
      else {
        // 안드로이드에서는 최종 결과가 있으면 그것만, 아니면 임시 결과 사용
        const newTranscript = hasFinalResult ? finalTranscript : interimTranscript;
        
        // 기존 트랜스크립트와 새 트랜스크립트를 비교하여 더 긴 쪽을 사용
        // 이렇게 하면 일시 정지 후에도 이전 내용이 유지됨
        if (newTranscript.length > transcript.length) {
          setTranscript(newTranscript);
          console.log('[useSpeechRecognition] Android - Updated transcript:', newTranscript);
        } else {
          console.log('[useSpeechRecognition] Android - Keeping existing transcript (longer)');
        }
      }
      
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
      console.log('[useSpeechRecognition] onend triggered, intentionalStop:', intentionalStopRef.current);
      
      // The 'onend' event fires when recognition stops for any reason.
      if (intentionalStopRef.current) {
        // If it was intentional, just update the state.
        console.log('[useSpeechRecognition] Intentional stop, cleaning up');
        setIsListening(false);
        intentionalStopRef.current = false; // Reset for next session
      } else if (recognitionRef.current) {
        // If it was NOT intentional (e.g., pause in speech, browser timeout),
        // and we still have a recognition instance, try to restart it.
        console.log('[useSpeechRecognition] Unintentional stop, attempting to restart');
        
        // Preserve the current transcript before restarting
        const currentTranscript = transcript;
        
        // Small delay before restarting to prevent rapid restarts
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              // For both iOS and Android, preserve the existing transcript
              if (isIOS) {
                // For iOS, update the final transcript ref
                finalTranscriptRef.current = currentTranscript;
                ignoreResultsRef.current = false;
                console.log('[useSpeechRecognition] iOS - Restarting with preserved transcript:', currentTranscript);
              } else {
                // For Android, we'll set the transcript directly after restart
                console.log('[useSpeechRecognition] Android - Restarting recognition');
              }
              
              recognitionRef.current.start();
              
              // For Android, we need to restore the transcript after restart
              if (!isIOS && currentTranscript) {
                setTimeout(() => {
                  setTranscript(currentTranscript);
                  console.log('[useSpeechRecognition] Android - Restored transcript after restart');
                }, 100);
              }
              
            } catch (e) {
              console.error('Error restarting speech recognition:', e);
              setIsListening(false);
            }
          }
        }, 100); // Small delay to prevent rapid restarts
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
      // iOS 기기에서만 음성 인식 시작 시 결과 무시 플래그 해제
      if (isIOS) {
        ignoreResultsRef.current = false;
        console.log('[useSpeechRecognition] iOS - Starting with ignoreResults=false');
      }
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
      // iOS 기기에서만 절 변경 시 늦게 도착하는 인식 결과를 무시하기 위해 플래그 설정
      if (isIOS) {
        ignoreResultsRef.current = true;
        console.log('[useSpeechRecognition] iOS - Stopping with ignoreResults=true');
      }
      recognitionRef.current.stop();
      // The onend event will handle setting isListening to false.
    } catch (e: any) {
      console.error('Error stopping speech recognition:', e);
      setError(`마이크 중지 오류: ${e.message}`);
    }
  }, [isListening]);

  // 음성 인식 텍스트를 강제로 초기화하는 함수
  const resetTranscript = useCallback(() => {
    setTranscript('');
    
    // 모든 기기에서 참조 변수 초기화
    finalTranscriptRef.current = '';
    lastInterimRef.current = '';
    ignoreResultsRef.current = true;
    
    // 현재 인식이 진행 중이면 잠시 중지하고 다시 시작하여 인식 결과를 초기화
    if (isListening && recognitionRef.current) {
      try {
        console.log('[useSpeechRecognition] Force resetting recognition by stop/start cycle');
        // 현재 인식 중지
        recognitionRef.current.stop();
        
        // 잠시 후 다시 시작 (onend 이벤트가 자동으로 호출되며 새로운 인식 세션 시작)
        setTimeout(() => {
          if (recognitionRef.current && isListening) {
            // iOS에서는 의도적인 초기화 시에만 ignoreResultsRef를 true로 유지
            if (isIOS) {
              console.log('[useSpeechRecognition] iOS - Restarting with cleared transcript');
            }
            recognitionRef.current.start();
            console.log('[useSpeechRecognition] Recognition restarted after reset');
          }
        }, isIOS ? 150 : 100); // iOS에서는 지연 시간을 약간 늘림
      } catch (e) {
        console.error('[useSpeechRecognition] Error during force reset:', e);
      }
    } else {
      console.log('[useSpeechRecognition] Transcript reset (not listening)');
    }
  }, [isIOS, isListening]);

  return { isListening, transcript, error, startListening, stopListening, browserSupportsSpeechRecognition, resetTranscript };
};

export default useSpeechRecognition;
