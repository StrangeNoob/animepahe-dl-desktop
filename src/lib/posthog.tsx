import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect, useRef, useState } from 'react'
import { trackAppStartupTime } from './analytics-utils'
import crypto from 'crypto-js'
import { getVersion } from '@tauri-apps/api/app'

// Record app start time for startup performance tracking
const appStartTime = typeof window !== 'undefined' ? Date.now() : 0

/**
 * Get OS type without version information for privacy
 */
function getOSType(): 'Windows' | 'macOS' | 'Linux' | 'Unknown' {
  if (typeof window === 'undefined') return 'Unknown'

  const platform = window.navigator.userAgent.toLowerCase()
  if (platform.includes('win')) return 'Windows'
  if (platform.includes('mac')) return 'macOS'
  if (platform.includes('linux')) return 'Linux'
  return 'Unknown'
}

/**
 * Determine if running in development or production
 */
function getEnvironment(): 'development' | 'production' {
  return import.meta.env.DEV ? 'development' : 'production'
}

/**
 * Generate a random session ID for grouping events
 */
function generateSessionId(): string {
  const stored = localStorage.getItem('analytics_session_id')
  if (stored) return stored

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  localStorage.setItem('analytics_session_id', sessionId)
  return sessionId
}

/**
 * Hash sensitive data using SHA256 for privacy
 */
export function sanitizeData(data: string): string {
  return crypto.SHA256(data).toString()
}

/**
 * Anonymize file paths by hashing them
 */
export function anonymizePath(path: string): string {
  if (!path) return ''
  // Only hash the filename part, keep directory structure anonymous
  const parts = path.split(/[/\\]/)
  const filename = parts[parts.length - 1]
  return sanitizeData(filename)
}


// Initialize PostHog only in browser environment
if (typeof window !== 'undefined') {
  const enableAnalytics = import.meta.env.VITE_PUBLIC_ENABLE_ANALYTICS === 'true'
  const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
  const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST
  console.log('Posthog key:', posthogKey)
  console.log('Posthog host:', posthogHost)
  console.log('Enable analytics:', enableAnalytics)
  if (enableAnalytics && posthogKey) {

    posthog.init(posthogKey, {
      api_host: posthogHost || 'https://app.posthog.com',
      capture_pageview: false,
      capture_pageleave: false,
      persistence: 'localStorage',
      autocapture: {
        dom_event_allowlist: ['click', 'change', 'submit']
      }
    })

    // Set initial super properties (app_version will be added by PostHogProvider)
    posthog.register({
      os_type: getOSType(),
      app_environment: getEnvironment(),
      session_id: generateSessionId()
    })
  } else {
    console.log('PostHog analytics is disabled or not configured')
  }
}

interface PostHogProviderProps {
  children: React.ReactNode
  enabled?: boolean
  theme?: 'dark' | 'light'
}

export function PostHogProvider({
  children,
  enabled = true,
  theme = 'dark'
}: PostHogProviderProps) {
  const startupTracked = useRef(false)

  useEffect(() => {
    const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS === 'true'
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY

    if (!enableAnalytics || !posthogKey) {
      return
    }

    if (enabled) {
      posthog.opt_in_capturing()

      // Update super properties with current theme
      posthog.register({
        app_version: '0.3.1',
        os_type: getOSType(),
        app_environment: getEnvironment(),
        session_id: generateSessionId(),
        ui_theme: theme
      })

      // Capture app launched event on mount
      posthog.capture('app_launched')

      // Track app startup time (only once)
      if (!startupTracked.current && appStartTime > 0) {
        trackAppStartupTime(posthog, appStartTime)
        startupTracked.current = true
      }
    } else {
      posthog.opt_out_capturing()
    }
  }, [enabled, theme])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

export { posthog }
