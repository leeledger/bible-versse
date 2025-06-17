import React, { useState } from 'react';

interface PasswordChangeFormProps {
  username: string;
  onPasswordChanged: () => void;
  onCancel: () => void;
  // Optional: Add a prop to display server-side errors if App.tsx handles them
  // serverError?: string | null;
  // clearServerError?: () => void;
}

const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({ 
  username,
  onPasswordChanged,
  onCancel 
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword.length < 5) {
      setError('새 비밀번호는 최소 5자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || '비밀번호 변경에 실패했습니다.');
      } else {
        alert('비밀번호가 성공적으로 변경되었습니다.'); // Or a more subtle notification
        onPasswordChanged();
      }
    } catch (err) {
      console.error('Password change error:', err);
      setError('비밀번호 변경 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 bg-white shadow-md rounded-lg max-w-sm mx-auto">
      <h2 className="text-2xl font-semibold text-center text-purple-600 mb-6">비밀번호 변경</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
            현재 비밀번호:
          </label>
          <input
            type="password"
            id="currentPassword"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            새 비밀번호:
          </label>
          <input
            type="password"
            id="newPassword"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">
            새 비밀번호 확인:
          </label>
          <input
            type="password"
            id="confirmNewPassword"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
            disabled={loading}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-1/2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-1/2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            {loading ? '변경 중...' : '변경하기'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordChangeForm;
