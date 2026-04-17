'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Project, Feedback, FeedbackStats } from '@/types/monitor';

// Feedback type icons and labels
const FEEDBACK_TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  suggestion: { icon: '💡', label: '建议', color: '#10B981' },
  bug: { icon: '🐛', label: 'Bug 报告', color: '#EF4444' },
  other: { icon: '📝', label: '其他', color: '#3B82F6' },
};

// Format date to YYYY-MM-DD
function formatDate(date: Date): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format datetime to readable string
function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get today's date string
function getTodayStr(): string {
  return formatDate(new Date());
}

export default function FeedbackPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState(false);
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Filter states
  const [filterType, setFilterType] = useState<string>('all');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return formatDate(date);
  });
  const [endDate, setEndDate] = useState(() => getTodayStr());

  // Selected feedback for detail panel
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  // Load project info
  const loadProjectInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();
      if (data.success && data.data.project) {
        const project = data.data.project;
        setProjectInfo(project);
        setApiKey(project.apiKey);
      }
    } catch (err) {
      console.error('Failed to load project info:', err);
    }
  }, [projectId]);

  // Load feedback data
  const loadFeedbacks = useCallback(async () => {
    if (!apiKey) return;
    
    setLoading(true);
    setError('');

    try {
      let url = `/api/feedback?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}`;
      if (filterType !== 'all') {
        url += `&type=${filterType}`;
      }

      const response = await fetch(url, {
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (response.status === 401) {
        setAuthError(true);
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setFeedbacks(data.data.feedbacks);
        setStats(data.data.stats);
        setAuthError(false);
      } else {
        setError(data.error || 'Failed to load feedback');
      }
    } catch (err) {
      console.error('Failed to load feedback:', err);
      setError('Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [projectId, apiKey, startDate, endDate, filterType]);

  // Load project info on mount
  useEffect(() => {
    loadProjectInfo();
  }, [loadProjectInfo]);

  // Load feedbacks when API key is ready
  useEffect(() => {
    if (apiKey) {
      loadFeedbacks();
    }
  }, [apiKey, loadFeedbacks]);

  // Handle copy user ID
  const handleCopyUserId = useCallback(async (userId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedUserId(userId);
      setTimeout(() => setCopiedUserId(null), 2000);
    } catch (err) {
      console.error('Failed to copy user ID:', err);
    }
  }, []);

  // Handle refresh
  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    await loadFeedbacks();
  };

  // Get type config
  const getTypeConfig = (type: string) => {
    return FEEDBACK_TYPE_CONFIG[type] || FEEDBACK_TYPE_CONFIG.other;
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {projectInfo?.name || 'Feedback'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              User Feedback Management
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <a
              href={`/dashboard/${projectId}`}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to Dashboard
            </a>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Feedback</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500">💡 Suggestions</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.suggestion}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500">🐛 Bug Reports</h3>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.bug}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500">📝 Other</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{stats.other}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="suggestion">💡 Suggestions</option>
                <option value="bug">🐛 Bug Reports</option>
                <option value="other">📝 Other</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Feedback list */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">
              Feedback List ({feedbacks.length})
            </h2>
          </div>
          
          {loading && !feedbacks.length ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-500">Loading feedback...</p>
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              No feedback found for this period
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {feedbacks.map((feedback) => {
                const typeConfig = getTypeConfig(feedback.type);
                return (
                  <div
                    key={feedback.id}
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedFeedback(feedback)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xl">{typeConfig.icon}</span>
                          <span 
                            className="px-2 py-1 text-xs font-medium rounded"
                            style={{ 
                              backgroundColor: `${typeConfig.color}20`,
                              color: typeConfig.color,
                            }}
                          >
                            {typeConfig.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDateTime(feedback.createdAt)}
                          </span>
                        </div>
                        <p className="text-gray-700 line-clamp-2">
                          {feedback.content}
                        </p>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                          <span>User: {feedback.userId?.slice(0, 10)}...</span>
                          {feedback.deviceType && (
                            <span>{feedback.deviceType}</span>
                          )}
                          {feedback.city && (
                            <span>{feedback.city}, {feedback.country}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedFeedback && (
        <div className="fixed right-0 top-0 h-full w-[600px] bg-white shadow-2xl border-l border-gray-200 overflow-hidden flex flex-col z-50">
          {/* Panel header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Feedback Details
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {formatDateTime(selectedFeedback.createdAt)}
              </p>
            </div>
            <button
              onClick={() => setSelectedFeedback(null)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-auto p-6">
            {/* Feedback type */}
            <div className="mb-6">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">{getTypeConfig(selectedFeedback.type).icon}</span>
                <span className="text-lg font-medium text-gray-900">
                  {getTypeConfig(selectedFeedback.type).label}
                </span>
              </div>
            </div>

            {/* Feedback content */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Content</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {selectedFeedback.content}
                </p>
              </div>
            </div>

            {/* User info */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">User Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">User ID</span>
                  <span 
                    className="font-mono cursor-pointer hover:text-blue-600"
                    onClick={() => selectedFeedback.userId && handleCopyUserId(selectedFeedback.userId)}
                  >
                    {selectedFeedback.userId ? (
                      <>
                        {selectedFeedback.userId.slice(0, 12)}...
                        {copiedUserId === selectedFeedback.userId && (
                          <span className="ml-1 text-xs text-green-600">✓ Copied!</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Submit Time</span>
                  <span className="text-gray-900">
                    {formatDateTime(selectedFeedback.timestamp)}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Device</span>
                  <span className="text-gray-900">
                    {selectedFeedback.deviceType || '-'} / {selectedFeedback.browser || '-'} / {selectedFeedback.os || '-'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Location</span>
                  <span className="text-gray-900">
                    {[selectedFeedback.city, selectedFeedback.region, selectedFeedback.country].filter(Boolean).join(', ') || '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={async () => {
                  if (selectedFeedback.content) {
                    await navigator.clipboard.writeText(selectedFeedback.content);
                    alert('Content copied to clipboard');
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                📋 Copy Content
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}