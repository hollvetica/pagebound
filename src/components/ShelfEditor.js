import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './ShelfEditor.css';

// Create a custom shelf, or rename / change visibility / delete one.
// onSave({ name, visibility }) and onDelete() return promises; their errors
// are shown in the sheet.
function ShelfEditor({ shelf, onSave, onDelete, onClose }) {
  const isNew = !shelf;
  const [name, setName] = useState(shelf?.name || '');
  const [visibility, setVisibility] = useState(shelf?.visibility || 'public');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    try {
      setBusy(true);
      setError(null);
      await action();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the shelf a name.');
      return;
    }
    run(() => onSave({ name: name.trim(), visibility }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal shelf-editor" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">✕</button>
        <h2>{isNew ? 'New shelf' : 'Edit shelf'}</h2>

        <div className="input-group">
          <label htmlFor="shelf-name">Name</label>
          <input
            id="shelf-name"
            className="input"
            value={name}
            maxLength={40}
            placeholder="e.g., Emma's book club"
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="input-group">
          <label>Who can see it</label>
          <div className="shelf-visibility-options" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={visibility === 'public'}
              className={`shelf-visibility-option ${visibility === 'public' ? 'active' : ''}`}
              onClick={() => setVisibility('public')}
            >
              <Eye size={16} />
              <span>
                <strong>Public</strong>
                <small>Friends can see this shelf</small>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={visibility === 'private'}
              className={`shelf-visibility-option ${visibility === 'private' ? 'active' : ''}`}
              onClick={() => setVisibility('private')}
            >
              <EyeOff size={16} />
              <span>
                <strong>Private</strong>
                <small>Only you can see it</small>
              </span>
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {isNew ? 'Create shelf' : 'Save'}
          </button>
        </div>

        {!isNew && onDelete && (
          <div className="shelf-editor-delete">
            {confirmingDelete ? (
              <>
                <p>Delete “{shelf.name}”? Its books stay in your library.</p>
                <div className="shelf-editor-delete-actions">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                    Keep it
                  </button>
                  <button type="button" className="btn-danger btn-sm" onClick={() => run(onDelete)} disabled={busy}>
                    Delete shelf
                  </button>
                </div>
              </>
            ) : (
              <button type="button" className="btn-danger btn-sm" onClick={() => setConfirmingDelete(true)}>
                Delete shelf
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

export default ShelfEditor;
