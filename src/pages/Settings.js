import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ThemeSelector from '../components/ThemeSelector';
import { themes } from '../themes';
import FavoriteBooksSelector from '../components/FavoriteBooksSelector';
import './Settings.css';

function Settings() {
  const { userProfile, changeUsername, updateProfilePhoto, updateUserProfile } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Tagline state
  const [tagline, setTagline] = useState(userProfile?.tagline || '');
  const [taglineLoading, setTaglineLoading] = useState(false);
  const [taglineError, setTaglineError] = useState('');
  const [taglineSuccess, setTaglineSuccess] = useState('');

  // Favorite books state
  const [isEditingFavorites, setIsEditingFavorites] = useState(false);
  const [selectedBooks, setSelectedBooks] = useState(userProfile?.favoriteBooks || []);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacyError, setPrivacyError] = useState('');

  const handlePrivacyToggle = async () => {
    setPrivacySaving(true);
    setPrivacyError('');
    const result = await updateUserProfile({ isPrivate: !userProfile?.isPrivate });
    if (!result.success) setPrivacyError(result.error || 'Could not update your privacy setting');
    setPrivacySaving(false);
  };

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

  // Avatar upload handlers
  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError('Image must be less than 5MB');
        return;
      }
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setAvatarError('File must be an image');
        return;
      }
      setAvatarError('');
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAvatarSave = async () => {
    if (!avatarFile) return;

    setAvatarUploading(true);
    setAvatarError('');

    const result = await updateProfilePhoto(avatarFile);

    setAvatarUploading(false);

    if (result.success) {
      setAvatarFile(null);
      setAvatarPreview(null);
      alert('Profile photo updated successfully!');
    } else {
      setAvatarError(result.error || 'Failed to update photo');
    }
  };

  // Tagline handlers
  const handleTaglineSave = async () => {
    if (tagline.length > 255) {
      setTaglineError('Tagline must be 255 characters or less');
      return;
    }

    setTaglineLoading(true);
    setTaglineError('');
    setTaglineSuccess('');

    const result = await updateUserProfile({ tagline });

    setTaglineLoading(false);

    if (result.success) {
      setTaglineSuccess('Tagline updated successfully!');
      setTimeout(() => setTaglineSuccess(''), 3000);
    } else {
      setTaglineError(result.error || 'Failed to update tagline');
    }
  };

  // Favorite books handlers
  const handleFavoriteBooksSave = async (books) => {
    if (books.length > 10) {
      alert('You can only select up to 10 favorite books');
      return;
    }

    const result = await updateUserProfile({ favoriteBooks: books });

    if (result.success) {
      setSelectedBooks(books);
      setIsEditingFavorites(false);
      alert('Favorite books updated successfully!');
    } else {
      alert('Failed to update favorite books: ' + result.error);
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

      {/* Profile Picture Section */}
      <div className="settings-section">
        <h3>Profile Picture</h3>
        <div className="avatar-upload-container">
          <div className="current-avatar">
            {avatarPreview || userProfile?.avatarUrl ? (
              <img
                src={avatarPreview || userProfile.avatarUrl}
                alt="Profile"
                className="avatar-preview"
              />
            ) : (
              <div className="avatar-letter">
                {userProfile?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="avatar-controls">
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              id="avatar-upload"
              style={{ display: 'none' }}
            />
            <label htmlFor="avatar-upload" className="upload-button">
              Choose Image
            </label>
            {avatarFile && (
              <button
                onClick={handleAvatarSave}
                className="save-button"
                disabled={avatarUploading}
              >
                {avatarUploading ? 'Uploading...' : 'Save Photo'}
              </button>
            )}
          </div>
        </div>
        {avatarError && <div className="error-message">{avatarError}</div>}
        <p className="upload-note">
          Any photo works: it's cropped to a square and resized for you.
        </p>
      </div>

      {/* Tagline Section */}
      <div className="settings-section">
        <h3>Personal Tagline</h3>
        <p className="section-note">
          Share a favorite line from a book, or a quote that represents you.
        </p>
        <div className="tagline-editor">
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g., 'Not all those who wander are lost' - J.R.R. Tolkien"
            maxLength={255}
            rows={3}
          />
          <div className="char-count">
            {tagline.length}/255
          </div>
          {taglineError && <div className="error-message">{taglineError}</div>}
          {taglineSuccess && <div className="success-message">{taglineSuccess}</div>}
          <button
            onClick={handleTaglineSave}
            className="save-button"
            disabled={taglineLoading}
          >
            {taglineLoading ? 'Saving...' : 'Save Tagline'}
          </button>
        </div>
      </div>

      {/* Favorite Books Section */}
      <div className="settings-section">
        <h3>Favorite Books</h3>
        <p className="section-note">
          Choose up to 10 books from your library to display on your profile.
        </p>
        {!isEditingFavorites ? (
          <div>
            <div className="favorite-books-display">
              {selectedBooks.length > 0 ? (
                selectedBooks.map((book) => (
                  <div key={book.isbn} className="favorite-book-mini">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} />
                    ) : (
                      <span className="book-icon">📚</span>
                    )}
                    <span>{book.title}</span>
                  </div>
                ))
              ) : (
                <p>No favorite books selected yet.</p>
              )}
            </div>
            <button
              onClick={() => setIsEditingFavorites(true)}
              className="edit-button"
            >
              Edit Favorites
            </button>
          </div>
        ) : (
          <FavoriteBooksSelector
            currentSelection={selectedBooks}
            onSave={handleFavoriteBooksSave}
            onCancel={() => setIsEditingFavorites(false)}
          />
        )}
      </div>

      <div className="settings-section">
        <h3>Privacy</h3>
        <div className="settings-toggle-row">
          <div>
            <p className="settings-toggle-label">Private profile</p>
            <p className="section-note">
              Off: everyone on Pagebound can see what you're reading in their feed. On: you're
              left out of everyone's feed and search, friends won't see your shelves, reviews
              or activity, and your reviews show as "A Pagebound reader". You can still read
              together in sessions.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!!userProfile?.isPrivate}
            className={`settings-switch ${userProfile?.isPrivate ? 'is-on' : ''}`}
            onClick={handlePrivacyToggle}
            disabled={privacySaving}
          >
            <span className="sr-only">Private profile</span>
          </button>
        </div>
        {privacyError && <div className="error-message">{privacyError}</div>}
        <p className="settings-email">
          Signed in as <strong>{userProfile?.email}</strong> · only you can see this
        </p>
      </div>

      {Object.keys(themes).length > 1 && (
        <div className="settings-section">
          <h3>Appearance</h3>
          <ThemeSelector />
        </div>
      )}
    </div>
  );
}

export default Settings;
