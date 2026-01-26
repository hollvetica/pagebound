import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './PasswordReset.css';

function PasswordReset({ onNavigateToLogin }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter code and new password
  
  const { initiatePasswordReset, confirmPasswordReset } = useAuth();

  const passwordValid = newPassword.length >= 6;

  const handleInitiate = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    const result = await initiatePasswordReset(email);
    
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Password reset code sent to your email!');
      setStep(2);
    } else {
      setErrorMessage(result.error || 'Failed to send reset code. Please try again.');
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!passwordValid) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    const result = await confirmPasswordReset(email, code, newPassword);
    
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        onNavigateToLogin();
      }, 2000);
    } else {
      setErrorMessage(result.error || 'Password reset failed. Please try again.');
    }
  };

  return (
    <div className="reset-container">
      <div className="reset-card">
        <h1>Reset Password</h1>
        <p className="reset-subtitle">
          {step === 1 ? 'Enter your email to receive a reset code' : 'Enter the code and your new password'}
        </p>
        
        {step === 1 ? (
          <form onSubmit={handleInitiate} className="reset-form">
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
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Enter your email"
              />
            </div>

            <button 
              type="submit" 
              className="reset-button"
              disabled={isLoading}
            >
              {isLoading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="reset-form">
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
            
            <div className="form-group">
              <label htmlFor="code">Confirmation Code</label>
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                placeholder="Enter code from email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
              <div className="password-requirements">
                <div className={`requirement ${passwordValid ? 'valid' : ''}`}>
                  <span className="checkmark">{passwordValid ? '✓' : '○'}</span>
                  At least 6 characters
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              className="reset-button"
              disabled={isLoading || !passwordValid}
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="reset-footer">
          <button 
            className="link-button" 
            onClick={onNavigateToLogin}
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

export default PasswordReset;
