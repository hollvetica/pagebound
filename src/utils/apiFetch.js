// fetch() for the Pagebound API: adds the signed-in user's Cognito ID token,
// which the API Gateway authorizer requires on every request.
import { fetchAuthSession } from 'aws-amplify/auth';

export const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch(url, options = {}) {
  let token = null;
  try {
    const session = await fetchAuthSession();
    token = session.tokens?.idToken?.toString() || null;
  } catch {
    // Not signed in; the API will answer 401
  }

  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = token;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  return fetch(url, { ...options, headers });
}

// apiFetch + JSON parsing; throws ApiError with the server's message on failure
export async function apiJson(path, options = {}) {
  const response = await apiFetch(`${API_ENDPOINT}${path}`, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Empty or non-JSON body
  }
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || data?.message || `Request failed (${response.status})`, data);
  }
  return data;
}
