import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeSelector from '../components/ThemeSelector';
import './Settings.css';

function Settings() {
  const { userProfile, changeUsername } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleUsernameChange = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newUsername.trim()) {
      setErrorMessage('Username cannot be empty');
      return;
    }

    if (newUsername === userProfile?.username) {
      setErrorMessage('This is already your username');
      return;
    }

    setIsLoading(true);

    const result = await changeUsername(newUsername);

    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Username updated successfully!');
      setNewUsername('');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage(result.error || 'Failed to update username');
    }
  };

  return (
    <div className="page settings-page">
      <h2>Settings</h2>

      <div className="settings-section">
        <h3>Account</h3>
        
        <div className="username-display">
          <div className="username-info">
            <label>Username</label>
            {!isEditing ? (
              <div className="current-username">
                <span>{userProfile?.username || 'Loading...'}</span>
                <button 
                  className="edit-button"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              </div>
            ) : (
              <form onSubmit={handleUsernameChange} className="username-form">
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
                <div className="username-edit-controls">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder={userProfile?.username}
                    autoFocus
                  />
                  <div className="button-group">
                    <button 
                      type="submit"
                      className="save-button"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      type="button"
                      className="cancel-button"
                      onClick={() => {
                        setIsEditing(false);
                        setNewUsername('');
                        setErrorMessage('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
          <p className="username-note">
            Your friends will see this name. Changing your username won't affect your friendships or reading progress.
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>
        <ThemeSelector />
      </div>
    </div>
  );
}

export default Settings;
