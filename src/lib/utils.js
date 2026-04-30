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

/**
 * Body Mass Index (BMI) Calculation
 * @param {number} weight - Weight in kg
 * @param {number} height - Height in cm
 */
export const calculateBMI = (weight, height) => {
  if (!weight || !height) return null;
  const heightInMeters = height / 100;
  const bmi = weight / (heightInMeters * heightInMeters);
  return bmi.toFixed(1);
};

export const getBMICategory = (bmi) => {
  if (!bmi) return null;
  const b = parseFloat(bmi);
  if (b < 18.5) return { label: 'Underweight', color: 'text-blue-500' };
  if (b < 25) return { label: 'Healthy', color: 'text-emerald-500' };
  if (b < 30) return { label: 'Overweight', color: 'text-orange-500' };
  return { label: 'Obese', color: 'text-red-500' };
};
