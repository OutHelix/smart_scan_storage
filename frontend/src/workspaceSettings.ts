export type WorkspaceSettings = {
  compactCards: boolean
  showConfidence: boolean
  autoOpenPreview: boolean
  accent: 'red' | 'rose' | 'sand'
}

export const WORKSPACE_SETTINGS_KEY = 'sss_profile_settings'

export const defaultWorkspaceSettings: WorkspaceSettings = {
  compactCards: false,
  showConfidence: true,
  autoOpenPreview: true,
  accent: 'red',
}

export function loadWorkspaceSettings(): WorkspaceSettings {
  try {
    const raw = localStorage.getItem(WORKSPACE_SETTINGS_KEY)
    if (!raw) return defaultWorkspaceSettings
    return {
      ...defaultWorkspaceSettings,
      ...(JSON.parse(raw) as Partial<WorkspaceSettings>),
    }
  } catch {
    return defaultWorkspaceSettings
  }
}

export function saveWorkspaceSettings(settings: WorkspaceSettings) {
  localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(settings))
}
