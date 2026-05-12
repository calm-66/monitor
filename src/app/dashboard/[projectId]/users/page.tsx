'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type UsOnlyUser = {
  id: string;
  username: string;
  email: string;
  inviteCode: string;
  avatarUrl: string | null;
  partnerId: string | null;
  isAdmin: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  disabledBy: string | null;
  deletionRequestedAt: string | null;
  deletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};

type PendingAction = {
  user: UsOnlyUser;
  action: 'disable' | 'enable' | 'forceDelete';
};

function getSessionToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('monitor_session_token') || '';
}

function formatDateTime(value: string | null): string {
  if (!value) return '-';

  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUserStatus(user: UsOnlyUser): { label: string; className: string } {
  if (user.deletedAt) {
    return { label: '已注销', className: 'bg-gray-100 text-gray-600' };
  }
  if (user.disabledAt) {
    return { label: '已冻结', className: 'bg-red-50 text-red-700' };
  }
  if (user.deletionRequestedAt) {
    return { label: '注销冷静期', className: 'bg-amber-50 text-amber-700' };
  }
  return { label: '正常', className: 'bg-emerald-50 text-emerald-700' };
}

export default function UsOnlyUsersPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UsOnlyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmitAction = useMemo(() => {
    if (!pendingAction) return false;
    if (pendingAction.action === 'enable') return true;
    if (!reason.trim()) return false;
    if (pendingAction.action === 'forceDelete') return confirmText === 'DELETE';
    return true;
  }, [confirmText, pendingAction, reason]);

  const searchUsers = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/usonly-admin/users?q=${encodeURIComponent(trimmed)}`, {
        headers: {
          'X-Monitor-Session-Token': getSessionToken(),
        },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '搜索失败');
      }

      setUsers(data.users || []);
      if (!data.users?.length) {
        setMessage('没有找到匹配用户');
      }
    } catch (err: any) {
      setUsers([]);
      setError(err.message || '搜索失败');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const openAction = (user: UsOnlyUser, action: PendingAction['action']) => {
    setPendingAction({ user, action });
    setReason('');
    setConfirmText('');
    setError('');
    setMessage('');
  };

  const closeAction = () => {
    if (submitting) return;
    setPendingAction(null);
    setReason('');
    setConfirmText('');
  };

  const submitAction = async () => {
    if (!pendingAction || !canSubmitAction) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const body: Record<string, string> = {
        action: pendingAction.action,
      };
      if (reason.trim()) body.reason = reason.trim();
      if (pendingAction.action === 'forceDelete') body.confirmText = confirmText;

      const res = await fetch(`/api/usonly-admin/users/${encodeURIComponent(pendingAction.user.id)}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Monitor-Session-Token': getSessionToken(),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '操作失败');
      }

      const actionLabel = pendingAction.action === 'disable'
        ? '冻结成功'
        : pendingAction.action === 'enable'
          ? '解除冻结成功'
          : '强制注销成功';
      setMessage(actionLabel);
      setPendingAction(null);
      await searchUsers();
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const actionTitle = pendingAction?.action === 'disable'
    ? '冻结账号'
    : pendingAction?.action === 'enable'
      ? '解除冻结'
      : '强制注销账号';

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">UsOnly 用户管理</h1>
            <p className="mt-1 text-sm text-gray-500">搜索用户并执行冻结、解除冻结或强制注销</p>
          </div>
          <a
            href={`/dashboard/${projectId}`}
            className="inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300"
          >
            返回 Dashboard
          </a>
        </div>

        <section className="mb-6 rounded-lg bg-white p-5 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') searchUsers();
              }}
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="输入用户 ID、邮箱、用户名或邀请码"
            />
            <button
              type="button"
              onClick={searchUsers}
              disabled={loading}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">建议使用完整 User ID 操作，避免用户名重复或误选。</p>
        </section>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <section className="overflow-hidden rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-800">搜索结果</h2>
          </div>

          {users.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400">
              输入关键词后搜索用户
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">用户</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">状态</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">角色</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">创建/登录</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">配对</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {users.map((user) => {
                    const status = getUserStatus(user);

                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{user.username}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                          <div className="mt-1 font-mono text-xs text-gray-400">{user.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                          {user.disabledReason && (
                            <div className="mt-1 max-w-[220px] truncate text-xs text-gray-500" title={user.disabledReason}>
                              {user.disabledReason}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {user.isAdmin ? '管理员' : '普通用户'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <div>创建：{formatDateTime(user.createdAt)}</div>
                          <div>登录：{formatDateTime(user.lastLoginAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {user.partnerId ? '已配对' : '未配对'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {user.disabledAt ? (
                              <button
                                type="button"
                                onClick={() => openAction(user, 'enable')}
                                disabled={Boolean(user.deletedAt)}
                                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                解除冻结
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openAction(user, 'disable')}
                                disabled={Boolean(user.deletedAt)}
                                className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                冻结
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openAction(user, 'forceDelete')}
                              disabled={Boolean(user.deletedAt)}
                              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              强制注销
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">{actionTitle}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {pendingAction.user.username} ({pendingAction.user.email})
              </p>
            </div>

            {pendingAction.action !== 'enable' && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">原因</label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="h-24 w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="填写操作原因"
                />
              </div>
            )}

            {pendingAction.action === 'forceDelete' && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">输入 DELETE 确认</label>
                <input
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="DELETE"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeAction}
                disabled={submitting}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={!canSubmitAction || submitting}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  pendingAction.action === 'forceDelete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {submitting ? '提交中...' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
