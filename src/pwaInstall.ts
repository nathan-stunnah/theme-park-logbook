export type InstallPlatform = 'installed' | 'ios' | 'android' | 'other'

type InstallEnvironment = {
  userAgent: string
  platform: string
  maxTouchPoints: number
  displayStandalone: boolean
  navigatorStandalone?: boolean
}

export function getInstallPlatform({
  userAgent,
  platform,
  maxTouchPoints,
  displayStandalone,
  navigatorStandalone = false,
}: InstallEnvironment): InstallPlatform {
  if (displayStandalone || navigatorStandalone) return 'installed'

  const isAppleMobile = /iphone|ipad|ipod/i.test(userAgent)
  const isTouchMac = platform === 'MacIntel' && maxTouchPoints > 1

  if (isAppleMobile || isTouchMac) return 'ios'
  if (/android/i.test(userAgent)) return 'android'

  return 'other'
}
