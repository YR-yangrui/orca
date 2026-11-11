import { useSyncExternalStore } from 'react'

const MODE_KEY = 'orca.session-groups.enabled.v1'
const PROJECTS_KEY = 'orca.session-groups.projects.v1'
const listeners = new Set<() => void>()

export function sessionGroupsEnabled(): boolean {
  return localStorage.getItem(MODE_KEY) !== 'false'
}

export function setSessionGroupsEnabled(enabled: boolean): void {
  localStorage.setItem(MODE_KEY, String(enabled))
  // This preference belongs to the desktop view, not the shared host settings.
  for (const listener of listeners) {
    listener()
  }
}

export function useSessionGroupsEnabled(): boolean {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, sessionGroupsEnabled)
}

export function sessionGroupProjects(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROJECTS_KEY) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return Object.fromEntries(Object.entries(value).filter((entry) => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

export function registerSessionGroupProject(groupId: string, repoId: string): void {
  localStorage.setItem(
    PROJECTS_KEY,
    JSON.stringify({ ...sessionGroupProjects(), [groupId]: repoId })
  )
}
