import React, { useState } from 'react';

interface AuthFormProps {
  onAuth: (username: string) => void;
  title?: string;
}

const AuthForm: React.FC<AuthFormProps> = ({ onAuth, title = "로그인 또는 사용자 등록" }) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('사용자 이름을 입력해주세요.');
      return;
    }
    setError('');
    onAuth(username.trim());
    setUsername(''); // Clear input after submission
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg max-w-sm mx-auto">
      <h2 className="text-2xl font-semibold text-center text-indigo-600 mb-6">{title}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700">
            사용자 이름:
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            aria-describedby="username-error"
          />
          {error && <p id="username-error" className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          계속하기
        </button>
      </form>
    </div>
  );
};

export default AuthForm;
