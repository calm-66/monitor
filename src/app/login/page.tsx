'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 检查是否已经登录（有有效的 session token）
    const checkSession = async () => {
      const token = localStorage.getItem('monitor_session_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (res.ok && data.valid) {
            // Session 有效，设置登录状态
            setIsLoggedIn(true);
            return;
          }
        } catch (error) {
          console.error('检查 session 失败:', error);
        }
      }
      // Session 无效，清除本地存储
      localStorage.removeItem('monitor_session_token');
      setIsLoggedIn(false);
    };
    
    checkSession();
  }, [router]);

  // 登出
  const handleLogout = async () => {
    const token = localStorage.getItem('monitor_session_token');
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch (error) {
        console.error('登出失败:', error);
      }
    }
    localStorage.removeItem('monitor_session_token');
    setIsLoggedIn(false);
    router.push('/login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '登录失败');
      }

      if (data.success) {
        // 保存 token 到 localStorage
        localStorage.setItem('monitor_session_token', data.data.token);
        // 跳转到首页
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-100 to-purple-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Monitor Dashboard
        </h1>
        <p className="text-center text-gray-500 mb-6">
          管理员登录
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="请输入管理员密码"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition disabled:opacity-50"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            返回首页
          </Link>
        </div>
        
        {isLoggedIn && (
          <div className="mt-4 text-center">
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-700"
            >
              退出登录
            </button>
          </div>
        )}
      </div>
    </main>
  );
}