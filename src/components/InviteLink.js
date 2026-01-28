import React, { useState } from 'react';
import { useFriends } from '../context/FriendsContext';
import { Link as LinkIcon, Copy, Check } from 'lucide-react';
import './InviteLink.css';

function InviteLink() {
  const { createInviteLink } = useFriends();
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      const data = await createInviteLink(30, null); // 30 days expiry, no max uses
      setInviteUrl(data.inviteUrl);
      setCopied(false);
    } catch (err) {
      alert('Failed to generate invite link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="invite-link">
      <div className="invite-header">
        <LinkIcon size={32} />
        <h2>Invite Friends to Pagebound</h2>
        <p>Share your unique invite link to help friends join Pagebound and connect with you!</p>
      </div>

      <div className="invite-actions">
        <button
          className="generate-btn"
          onClick={handleGenerateLink}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate Invite Link'}
        </button>
      </div>

      {inviteUrl && (
        <div className="invite-result">
          <div className="invite-url-container">
            <div className="invite-url">
              <LinkIcon size={18} />
              <span>{inviteUrl}</span>
            </div>
            <button
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copied ? (
                <>
                  <Check size={18} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={18} />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="invite-info">
            <p>This link will expire in 30 days</p>
          </div>
        </div>
      )}

      <div className="invite-features">
        <h3>What happens when someone uses your link?</h3>
        <ul>
          <li>They'll be directed to sign up for Pagebound</li>
          <li>After signing up, they'll automatically be prompted to add you as a friend</li>
          <li>You'll see their friend request in the Requests tab</li>
          <li>Once accepted, you can start reading sessions together!</li>
        </ul>
      </div>

      <div className="invite-tips">
        <h3>Sharing Tips</h3>
        <ul>
          <li>Share the link via text, email, or social media</li>
          <li>Links expire after 30 days for security</li>
          <li>Generate a new link anytime you need</li>
        </ul>
      </div>
    </div>
  );
}

export default InviteLink;
