// Dev-only UI preview: http://localhost:3000/?preview shows the signed-in
// screens with a placeholder user and local sample data, without Cognito.
export const isPreviewMode = () =>
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  window.location.search.includes('preview');
