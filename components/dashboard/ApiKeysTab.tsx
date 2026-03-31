'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Copy, Check, AlertTriangle, Key, X } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  created_at: string
}

// No explicit return type annotation — matches the convention used throughout
// this codebase (Header.tsx, Sidebar.tsx, etc. all omit return types).
export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const loadKeys = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/admin/keys')
      const data = (await res.json()) as {
        success: boolean
        data?: ApiKey[]
      }
      if (data.success && data.data) setKeys(data.data)
    } catch {
      // Non-critical — list stays empty, user can retry by refreshing
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setFormError('')

    const trimmed = newKeyName.trim()
    if (trimmed.length < 2) {
      setFormError('Name must be at least 2 characters.')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = (await res.json()) as {
        success: boolean
        data?: ApiKey & { raw_key: string }
        error?: string
      }

      if (!data.success) {
        setFormError(data.error ?? 'Failed to create key.')
        return
      }

      setRevealedKey(data.data!.raw_key)
      setNewKeyName('')
      setShowCreateForm(false)
      await loadKeys()
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string): Promise<void> => {
    if (
      !confirm(
        `Revoke API key "${name}"?\n\nAny application using this key loses access immediately. This cannot be undone.`
      )
    )
      return

    setDeletingId(id)
    try {
      const res = await fetch(
        `/api/admin/keys?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as { success: boolean; error?: string }
      if (data.success) {
        setKeys((prev) => prev.filter((k) => k.id !== id))
      } else {
        alert(data.error ?? 'Failed to revoke key.')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const formatDate = (iso: string | null): string => {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const closeCreateForm = (): void => {
    setShowCreateForm(false)
    setNewKeyName('')
    setFormError('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">API Keys</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Use API keys to authenticate requests from your server-side apps,
          WordPress plugins, or any custom integration. Treat them like
          passwords — never commit them to Git or put them in client-side code.
        </p>
      </div>

      {/* One-time key reveal banner */}
      {revealedKey !== null && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-800 mb-2">
                Copy your API key now — it will never be shown again.
              </p>
              <div className="flex items-center gap-2 bg-white border border-emerald-300 rounded-md pl-3 pr-2 py-2">
                <code className="flex-1 text-sm font-mono text-gray-900 break-all select-all">
                  {revealedKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(revealedKey)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRevealedKey(null)}
                className="mt-3 text-xs text-emerald-700 hover:text-emerald-900 underline"
              >
                I've saved my key — dismiss this
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form or create button */}
      {showCreateForm ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-gray-800">New API Key</h4>
            <button
              type="button"
              onClick={closeCreateForm}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div>
              <label
                htmlFor="api-key-name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Key Name
              </label>
              <input
                id="api-key-name"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. WordPress Site, Production App"
                maxLength={60}
                autoFocus
              />
              {formError && (
                <p className="mt-1.5 text-xs text-red-600" role="alert">
                  {formError}
                </p>
              )}
              <p className="mt-1.5 text-xs text-gray-400">
                Use a name you'll recognise later.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create Key'}
              </button>
              <button
                type="button"
                onClick={closeCreateForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          disabled={keys.length >= 10}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      )}

      {/* Keys table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center">
            <Key className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No API keys yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create a key to start integrating with external apps.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Last Used
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Created
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((key) => (
                <tr
                  key={key.id}
                  className="bg-white hover:bg-gray-50 transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-gray-800">
                    {key.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {key.key_prefix}…
                    </code>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden sm:table-cell">
                    {formatDate(key.last_used_at)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                    {formatDate(key.created_at)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(key.id, key.name)}
                      disabled={deletingId === key.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === key.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick reference */}
      <div className="bg-gray-900 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-100 mb-4">
          Quick Reference
        </h4>
        <div className="space-y-3 text-xs font-mono">
          {[
            { method: 'POST',  color: 'text-green-400',  path: '/api/v1/subscriptions/check', desc: 'Check subscription by email' },
            { method: 'GET',   color: 'text-blue-400',   path: '/api/v1/subscribers',         desc: 'List subscribers (paginated)' },
            { method: 'GET',   color: 'text-blue-400',   path: '/api/v1/subscribers/:id',     desc: 'Get single subscriber' },
            { method: 'PATCH', color: 'text-yellow-400', path: '/api/v1/subscribers/:id',     desc: 'Update subscriber status' },
            { method: 'GET',   color: 'text-blue-400',   path: '/api/v1/plans',               desc: 'List subscription plans' },
          ].map(({ method, color, path, desc }) => (
            <div key={`${method}${path}`} className="flex items-start gap-3">
              <span className={`${color} w-12 flex-shrink-0`}>{method}</span>
              <span className="text-gray-300 flex-1">{path}</span>
              <span className="text-gray-500 hidden md:block">{desc}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Authentication:{' '}
          <code className="text-gray-300">X-API-Key: sub_live_…</code>
        </p>
      </div>

      {keys.length >= 10 && (
        <p className="text-xs text-amber-600">
          Maximum of 10 API keys reached. Revoke an existing key to create a new one.
        </p>
      )}
    </div>
  )
}
