import React, { useState } from 'react';

interface AuthFormProps {
  onAuth: (username: string, password_provided: string) => Promise<boolean>; // For login, returns true if success, false if fail
  onRegister: (username: string, password_provided: string) => Promise<{ success: boolean; message: string }>;
  title?: string;
}

const AuthForm: React.FC<AuthFormProps> = ({ onAuth, onRegister, title }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // Added password state
  const [error, setError] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('사용자 이름을 입력해주세요.');
      return;
    }
    if (!password) { // Added password validation
      setError('비밀번호를 입력해주세요.');
      return;
    }
    setError('');
    setSuccessMessage('');

    if (isRegisterMode) {
      try {
        const result = await onRegister(username.trim(), password);
        if (result.success) {
          setSuccessMessage(result.message);
          setUsername('');
          setPassword('');
          setIsRegisterMode(false); // Switch to login mode after successful registration
        } else {
          setError(result.message || '등록에 실패했습니다.');
        }
      } catch (regError) {
        console.error('Registration error in AuthForm:', regError);
        setError('등록 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } else {
      try {
        const loginResult = await onAuth(username.trim(), password);
        // If loginResult is falsy, show password error
        if (!loginResult) {
          setError('비밀번호를 확인하세요.');
        }
      } catch (e) {
        setError('비밀번호를 확인하세요.');
      }
      // Optimistically clear for login, App.tsx handles actual auth state
      // setUsername(''); 
      // setPassword('');
    }
  };

  return (
    <div className="p-8 bg-amber-50 shadow-xl rounded-lg max-w-md mx-auto border-2 border-amber-700 font-serif">

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="username" className="block text-md font-medium text-amber-700 mb-1">
            사용자명:
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full px-4 py-2 border border-amber-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 placeholder-amber-400"
            placeholder="사용자명 입력해 주세요"
            autoComplete="username"
          />
          {error && !successMessage && <p id="auth-error" className="mt-2 text-sm text-red-700 font-sans">{error}</p>}
          {successMessage && <p id="auth-success" className="mt-2 text-sm text-green-700 font-sans">{successMessage}</p>}
        </div>
        {/* Password Field */}
        <div>
          <label htmlFor="password" className="block text-md font-medium text-amber-700 mb-1">
            비밀번호:
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요..."
            className="mt-1 block w-full px-4 py-3 bg-amber-100 border border-amber-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 sm:text-lg text-amber-900 placeholder-amber-600"
            aria-describedby="password-error" 
          />
        </div>
        <button
          type="submit"
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 text-lg"
        >
          {isRegisterMode ? '새 계정 등록하기' : '말씀으로 들어가기'}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setIsRegisterMode(!isRegisterMode);
            setError('');
            setSuccessMessage('');
            setUsername(''); // Clear fields when switching mode
            setPassword('');
          }}
          className="text-sm text-amber-700 hover:text-amber-800 hover:underline font-sans"
        >
          {isRegisterMode ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 등록하기'}
        </button>
      </div>      
    <div className="mt-10 text-center text-xs text-gray-400 font-sans select-none">
      <div className="mb-1">포도나무교회 &nbsp;|&nbsp; Dev: 이종림 &nbsp;|&nbsp; <a href="mailto:luxual8@gmail.com" className="underline hover:text-amber-700">문의 및 개선사항</a></div>
      <div className="mb-1">© 2025 이종림. All rights reserved.</div>
      <div className="mb-1">Copyright © 2025 Lee Jongrim. All rights reserved.</div>
      <div className="italic text-[11px] text-gray-300">음성 인식 정확도를 위해 조용한 환경을 권장합니다.</div>
    </div>

    </div>
  );
};

export default AuthForm;
