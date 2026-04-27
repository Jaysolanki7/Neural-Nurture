/**
 * Utility function to get the current URL for redirects
 * This handles localhost, Vercel deployments, and custom domains
 */
export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ??
    process?.env?.NEXT_PUBLIC_VERCEL_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000/')

  // Make sure to include `https://` when not localhost.
  if (!url.includes('http')) {
    url = `https://${url}`
  }
  
  // Make sure to include a trailing `/`.
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`
  
  return url
}
