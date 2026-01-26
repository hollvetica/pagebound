// User service for DynamoDB operations
const API_ENDPOINT = process.env.REACT_APP_API_ENDPOINT;

export const fetchUserProfile = async (email) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/users/${email}`);
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
};

export const createUserProfile = async (email, username) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, isAdmin: false })
    });
    if (!response.ok) throw new Error('Failed to create user profile');
    return await response.json();
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

export const updateUsername = async (email, newUsername) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/users/${email}/username`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newUsername })
    });
    if (!response.ok) throw new Error('Failed to update username');
    return await response.json();
  } catch (error) {
    console.error('Error updating username:', error);
    throw error;
  }
};

export const checkUsernameAvailable = async (username) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/users/check-username/${username}`);
    if (!response.ok) throw new Error('Failed to check username');
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking username:', error);
    return false;
  }
};

export const getAllUsers = async () => {
  try {
    const response = await fetch(`${API_ENDPOINT}/admin/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
};

export const updateUserAdmin = async (email, isAdmin) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/admin/users/${email}/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin })
    });
    if (!response.ok) throw new Error('Failed to update admin status');
    return await response.json();
  } catch (error) {
    console.error('Error updating admin status:', error);
    throw error;
  }
};

export const sendPasswordReset = async (email) => {
  try {
    const response = await fetch(`${API_ENDPOINT}/admin/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) throw new Error('Failed to send password reset');
    return await response.json();
  } catch (error) {
    console.error('Error sending password reset:', error);
    throw error;
  }
};
