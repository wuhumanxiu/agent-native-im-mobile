import Constants from 'expo-constants'
import * as Updates from 'expo-updates'

export interface BuildInfo {
  version: string
  runtimeVersion: string
  commit: string
  buildTime: string
}

const release =
  ((Constants.expoConfig as any)?.extra?.release ??
    (Updates.manifest as any)?.extra?.release ??
    (Updates.manifest2 as any)?.extra?.release ??
    {}) as Partial<BuildInfo>

export const buildInfo: BuildInfo = {
  version: typeof release.version === 'string' ? release.version : '1.6.2',
  runtimeVersion:
    typeof Updates.runtimeVersion === 'string' && Updates.runtimeVersion
      ? Updates.runtimeVersion
      : typeof release.runtimeVersion === 'string'
        ? release.runtimeVersion
        : 'native-2026-03-27.1',
  commit: typeof release.commit === 'string' ? release.commit : 'local',
  buildTime:
    typeof release.buildTime === 'string'
      ? release.buildTime
      : new Date(0).toISOString(),
}
