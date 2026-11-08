import { execFileSync } from 'node:child_process'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

export function resolveProxySettings(env: NodeJS.ProcessEnv, windowsProxy?: string) {
  const schemes = new Map((windowsProxy || '').split(';').filter(Boolean).map(item => {
    const index = item.indexOf('=')
    return index < 0 ? ['all', item.trim()] : [item.slice(0, index).trim(), item.slice(index + 1).trim()]
  }))
  const normalize = (value?: string) => value ? (/^https?:\/\//i.test(value) ? value : `http://${value}`) : undefined
  const explicitHttp = env.http_proxy || env.HTTP_PROXY || env.all_proxy || env.ALL_PROXY
  const explicitHttps = env.https_proxy || env.HTTPS_PROXY || env.all_proxy || env.ALL_PROXY
  const hasExplicit = Boolean(explicitHttp || explicitHttps)
  return {
    httpProxy: hasExplicit ? explicitHttp || explicitHttps : normalize(schemes.get('http') || schemes.get('all')),
    httpsProxy: hasExplicit ? explicitHttps || explicitHttp : normalize(schemes.get('https') || schemes.get('http') || schemes.get('all')),
    noProxy: [env.no_proxy || env.NO_PROXY, 'localhost', '127.0.0.1', '[::1]'].filter(Boolean).join(','),
  }
}

/** Node 22 fetch does not use Windows' system proxy automatically. */
export function configureNetwork() {
  if (process.env.STUDIO_SYSTEM_PROXY === 'off') return
  let windowsProxy: string | undefined
  if (process.platform === 'win32' && !process.env.HTTP_PROXY && !process.env.HTTPS_PROXY && !process.env.http_proxy && !process.env.https_proxy && !process.env.ALL_PROXY && !process.env.all_proxy) {
    try {
      const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        "$p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'; if($p.ProxyEnable -eq 1){[Console]::Write($p.ProxyServer)}"],
        { encoding: 'utf8', windowsHide: true, timeout: 5000 }).trim()
      windowsProxy = raw || undefined
    } catch { /* No system proxy available; retain native direct networking. */ }
  }
  const settings = resolveProxySettings(process.env, windowsProxy)
  if (!settings.httpProxy && !settings.httpsProxy) return
  setGlobalDispatcher(new EnvHttpProxyAgent(settings))
  console.log('[Network] Proxy enabled; loopback connections bypass it')
}
