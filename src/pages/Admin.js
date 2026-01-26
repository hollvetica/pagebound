import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, updateUserAdmin, sendPasswordReset } from '../utils/userService';
import './Admin.css';

function Admin() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isSuperAdmin = userProfile?.email === 'hollie.tanner@gmail.com';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const allUsers = await getAllUsers();
    setUsers(allUsers);
    setLoading(false);
  };

  const handleAdminToggle = async (email, currentAdminStatus) => {
    // Prevent revoking super admin status
    if (email === 'hollie.tanner@gmail.com') {
      setErrorMessage('Cannot modify super admin status');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    // Only super admin can make others admin
    if (!isSuperAdmin && !currentAdminStatus) {
      setErrorMessage('Only super admin can grant admin privileges');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      
      await updateUserAdmin(email, !currentAdminStatus);
      
      setSuccessMessage(`Admin status ${!currentAdminStatus ? 'granted' : 'revoked'} successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Reload users
      await loadUsers();
    } catch (error) {
      setErrorMessage('Failed to update admin status');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePasswordReset = async (email) => {
    try {
      setErrorMessage('');
      setSuccessMessage('');
      
      await sendPasswordReset(email);
      
      setSuccessMessage(`Password reset email sent to ${email}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Failed to send password reset');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  if (!userProfile?.isAdmin) {
    return (
      <div className="page admin-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page admin-page">
      <div className="admin-header">
        <h2>Admin Panel</h2>
        <p className="admin-subtitle">Manage user accounts and permissions</p>
      </div>

      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading users...</div>
      ) : (
        <div className="users-grid">
          <div className="grid-header">
            <div className="grid-cell">Email</div>
            <div className="grid-cell">Username</div>
            <div className="grid-cell">Admin</div>
            <div className="grid-cell">Actions</div>
          </div>

          {users.map((user) => {
            const isUserSuperAdmin = user.email === 'hollie.tanner@gmail.com';
            
            return (
              <div key={user.email} className="grid-row">
                <div className="grid-cell">
                  {user.email}
                  {isUserSuperAdmin && <span className="super-admin-badge">Super Admin</span>}
                </div>
                <div className="grid-cell">{user.username}</div>
                <div className="grid-cell">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={user.isAdmin}
                      onChange={() => handleAdminToggle(user.email, user.isAdmin)}
                      disabled={isUserSuperAdmin || (!isSuperAdmin && !user.isAdmin)}
                    />
                    <span className="checkmark"></span>
                  </label>
                </div>
                <div className="grid-cell">
                  <button
                    className="reset-password-button"
                    onClick={() => handlePasswordReset(user.email)}
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Admin;
