'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserUsageSummary } from '@/types/monitor';

type UserUsageLookupProps = {
  projectId: string;
};

type PartnerUsageState = {
  expanded: boolean;
  loading: boolean;
  error: string;
  usage: UserUsageSummary | null;
};

function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthStart(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function InlineList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
  emptyText: string;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700">{title}</h4>
      <div className="mt-3 space-y-2">
        {items.length > 0 ? (
          items.slice(0, 5).map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-mono text-xs text-gray-900">{item.name}</span>
              <span className="flex-shrink-0 tabular-nums text-gray-500">{item.count}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

export default function UserUsageLookup({ projectId }: UserUsageLookupProps) {
  const [apiKey, setApiKey] = useState('');
  const [usageUserId, setUsageUserId] = useState('');
  const [startDate, setStartDate] = useState(getCurrentMonthStart);
  const [endDate, setEndDate] = useState(getTodayStr);
  const [userUsage, setUserUsage] = useState<UserUsageSummary | null>(null);
  const [partnerUsage, setPartnerUsage] = useState<PartnerUsageState>({
    expanded: false,
    loading: false,
    error: '',
    usage: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProjectInfo = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();
        if (data.success && data.data.project) {
          setApiKey(data.data.project.apiKey || '');
        }
      } catch (err) {
        console.error('Failed to load project info:', err);
      }
    };

    loadProjectInfo();
  }, [projectId]);

  const searchUserUsage = useCallback(async () => {
    const trimmedUserId = usageUserId.trim();
    if (!trimmedUserId) {
      setError('Please enter a user ID');
      setUserUsage(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/stats/user-usage?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}&userId=${encodeURIComponent(trimmedUserId)}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setUserUsage(null);
        setPartnerUsage({
          expanded: false,
          loading: false,
          error: '',
          usage: null,
        });
        setError(data.error || 'Failed to load user usage');
        return;
      }

      setUserUsage(data.data);
      setPartnerUsage({
        expanded: false,
        loading: false,
        error: '',
        usage: null,
      });
    } catch (err) {
      console.error('Failed to load user usage:', err);
      setUserUsage(null);
      setPartnerUsage({
        expanded: false,
        loading: false,
        error: '',
        usage: null,
      });
      setError('Failed to load user usage');
    } finally {
      setLoading(false);
    }
  }, [apiKey, endDate, projectId, startDate, usageUserId]);

  const togglePartnerUsage = useCallback(async () => {
    const partnerId = userUsage?.contentStats?.user.partnerId;
    if (!partnerId) return;

    if (partnerUsage.expanded) {
      setPartnerUsage((previous) => ({
        ...previous,
        expanded: false,
      }));
      return;
    }

    if (partnerUsage.usage || partnerUsage.error) {
      setPartnerUsage((previous) => ({
        ...previous,
        expanded: true,
      }));
      return;
    }

    setPartnerUsage({
      expanded: true,
      loading: true,
      error: '',
      usage: null,
    });

    try {
      const response = await fetch(
        `/api/stats/user-usage?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}&userId=${encodeURIComponent(partnerId)}`,
        {
          headers: {
            'X-API-Key': apiKey,
          },
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load partner usage');
      }

      setPartnerUsage({
        expanded: true,
        loading: false,
        error: '',
        usage: data.data,
      });
    } catch (err: any) {
      console.error('Failed to load partner usage:', err);
      setPartnerUsage({
        expanded: true,
        loading: false,
        error: err.message || 'Failed to load partner usage',
        usage: null,
      });
    }
  }, [apiKey, endDate, partnerUsage.error, partnerUsage.expanded, partnerUsage.usage, projectId, startDate, userUsage]);

  return (
    <section className="mb-6 rounded-lg bg-white p-5 shadow-md">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">User Usage Lookup</h2>
          <p className="mt-1 text-sm text-gray-500">
            Search by UsOnly user ID, username, user_ ID, or Monitor visitor ID within the selected date range.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_160px_minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-gray-500">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-gray-500">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-gray-500">User ID or Username</span>
            <input
              type="text"
              value={usageUserId}
              onChange={(event) => setUsageUserId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  searchUserUsage();
                }
              }}
              placeholder="Enter user ID or username"
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={searchUserUsage}
              disabled={loading || !apiKey}
              className="w-full rounded-md bg-amber-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      {userUsage && (
        <div className="mt-6 border-t border-gray-200 pt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-gray-700">UsOnly Content</h4>
            {userUsage.contentStatsError && (
              <span className="text-xs text-amber-600">{userUsage.contentStatsError}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Posts" value={userUsage.contentStats?.totalPosts ?? '-'} />
            <MetricCard label="Images" value={userUsage.contentStats?.totalImages ?? '-'} />
            <MetricCard label="Comments" value={userUsage.contentStats?.totalComments ?? '-'} />
            <MetricCard label="Logins" value={userUsage.totalLogins} />
            <MetricCard label="Active Days" value={userUsage.activeDays} />
            <MetricCard label="Events" value={userUsage.totalEvents} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <h4 className="text-sm font-semibold text-gray-700">Identity</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Username</dt>
                  <dd className="break-all font-medium text-gray-900">{userUsage.contentStats?.user.username || userUsage.username || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="break-all font-mono text-xs text-gray-900">{userUsage.contentStats?.user.email || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">UsOnly ID</dt>
                  <dd className="break-all font-mono text-xs text-gray-900">{userUsage.usOnlyUserId || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Monitor ID</dt>
                  <dd className="break-all font-mono text-xs text-gray-900">{userUsage.monitorUserId || '-'}</dd>
                </div>
                {userUsage.contentStats?.user.partnerId && (
                  <div>
                    <dt className="text-gray-500">Partner</dt>
                    <dd className="mt-1">
                      <button
                        type="button"
                        onClick={togglePartnerUsage}
                        disabled={partnerUsage.loading}
                        className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {partnerUsage.loading
                          ? '查询中...'
                          : partnerUsage.expanded
                            ? '收起伴侣信息'
                            : '查看伴侣信息'}
                      </button>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700">Activity</h4>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">First Seen</dt>
                  <dd className="font-mono text-xs text-gray-900">{userUsage.firstSeenAt || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Last Seen</dt>
                  <dd className="font-mono text-xs text-gray-900">{userUsage.lastSeenAt || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">First Post</dt>
                  <dd className="font-mono text-xs text-gray-900">{userUsage.contentStats?.firstPostAt || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Last Post</dt>
                  <dd className="font-mono text-xs text-gray-900">{userUsage.contentStats?.lastPostAt || '-'}</dd>
                </div>
              </dl>
            </div>

            <InlineList title="Top Pages" items={userUsage.topPages} emptyText="No page data" />
          </div>

          {partnerUsage.expanded && (
            <div className="mt-6 rounded-lg border border-amber-100 bg-amber-50/40 p-4">
              <h4 className="text-sm font-semibold text-gray-700">Partner Info</h4>
              {partnerUsage.loading ? (
                <p className="mt-3 text-sm text-amber-700">正在查询伴侣信息...</p>
              ) : partnerUsage.error ? (
                <p className="mt-3 text-sm text-red-600">{partnerUsage.error}</p>
              ) : partnerUsage.usage ? (
                <div className="mt-3 grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Username</p>
                    <p className="mt-1 break-all font-medium text-gray-900">
                      {partnerUsage.usage.contentStats?.user.username || partnerUsage.usage.username || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Email</p>
                    <p className="mt-1 break-all font-mono text-xs text-gray-900">
                      {partnerUsage.usage.contentStats?.user.email || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">UsOnly ID</p>
                    <p className="mt-1 break-all font-mono text-xs text-gray-900">
                      {partnerUsage.usage.usOnlyUserId || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Last Seen</p>
                    <p className="mt-1 font-mono text-xs text-gray-900">{partnerUsage.usage.lastSeenAt || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Logins</p>
                    <p className="mt-1 font-semibold text-gray-900">{partnerUsage.usage.totalLogins}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Events</p>
                    <p className="mt-1 font-semibold text-gray-900">{partnerUsage.usage.totalEvents}</p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {userUsage.contentStats?.recentPosts && userUsage.contentStats.recentPosts.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-sm font-semibold text-gray-700">Recent Posts</h4>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Images</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Archived</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {userUsage.contentStats.recentPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">{post.createdAt}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">{post.date}</td>
                        <td className="px-4 py-3 text-sm tabular-nums text-gray-900">{post.imageCount}</td>
                        <td className="max-w-[160px] truncate px-4 py-3 text-sm text-gray-900">{post.location || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{post.archivedAt ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">Recent Events</h4>
            {userUsage.recentEvents.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[760px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Event</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Page</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Device</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Browser</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {userUsage.recentEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">{event.createdAt}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{event.eventName || event.eventType}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-blue-600">{event.pageUrl || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{event.city || event.region || event.country || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{event.deviceType || event.os || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{event.browser || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 py-8 text-center text-sm text-gray-400">
                No events found for this user in the selected date range
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
