import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Signup.css';

function Signup({ onNavigateToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  
  const { signup, confirmSignup } = useAuth();

  const passwordValid = password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!passwordValid) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    if (!username.trim()) {
      setErrorMessage('Username is required');
      return;
    }

    setIsLoading(true);

    const result = await signup(email, password, username);
    
    setIsLoading(false);

    if (result.success) {
      if (result.requiresConfirmation) {
        setShowConfirmation(true);
      } else {
        onNavigateToLogin();
      }
    } else {
      setErrorMessage(result.error || 'Sign up failed. Please try again.');
    }
  };

  const handleConfirmation = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const result = await confirmSignup(email, confirmationCode);
    
    setIsLoading(false);

    if (result.success) {
      onNavigateToLogin();
    } else {
      setErrorMessage(result.error || 'Confirmation failed. Please try again.');
    }
  };

  if (showConfirmation) {
    return (
      <div className="signup-container">
        <div className="signup-card">
          <h1>Confirm Your Email</h1>
          <p className="signup-subtitle">
            We sent a confirmation code to {email}
          </p>
          
          <form onSubmit={handleConfirmation} className="signup-form">
            {errorMessage && (
              <div className="error-message">
                {errorMessage}
              </div>
            )}
            
            <div className="form-group">
              <label htmlFor="code">Confirmation Code</label>
              <input
                type="text"
                id="code"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                required
                placeholder="Enter 6-digit code"
              />
            </div>

            <button 
              type="submit" 
              className="signup-button"
              disabled={isLoading}
            >
              {isLoading ? 'Confirming...' : 'Confirm'}
            </button>
          </form>

          <div className="signup-footer">
            <button 
              className="link-button" 
              onClick={() => setShowConfirmation(false)}
            >
              Back to sign up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container">
      <div className="signup-card">
        <h1>Join Pagebound</h1>
        <p className="signup-subtitle">Create your account to start reading together</p>
        
        <form onSubmit={handleSubmit} className="signup-form">
          {errorMessage && (
            <div className="error-message">
              {errorMessage}
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

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Choose a unique username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            className="signup-button"
            disabled={isLoading || !passwordValid}
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <div className="signup-footer">
          <p>
            Already have an account?{' '}
            <button 
              className="link-button" 
              onClick={onNavigateToLogin}
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
