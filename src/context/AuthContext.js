import React, { createContext, useState, useContext, useEffect } from 'react';
import { getCurrentUser, signIn, signUp, signOut, confirmSignUp, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { fetchUserProfile, createUserProfile, updateUsername, checkUsernameAvailable } from '../utils/userService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Fetch user profile from DynamoDB
      const profile = await fetchUserProfile(currentUser.signInDetails.loginId);
      setUserProfile(profile);
    } catch (err) {
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password, username) => {
    try {
      setError(null);
      
      // Check if username is available
      const isAvailable = await checkUsernameAvailable(username);
      if (!isAvailable) {
        return { success: false, error: 'Username already taken' };
      }

      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email
          }
        }
      });

      // Create user profile in DynamoDB
      await createUserProfile(email, username);

      return { 
        success: true, 
        isSignUpComplete, 
        userId, 
        nextStep,
        requiresConfirmation: nextStep.signUpStep === 'CONFIRM_SIGN_UP'
      };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const confirmSignup = async (email, code) => {
    try {
      setError(null);
      const { isSignUpComplete } = await confirmSignUp({
        username: email,
        confirmationCode: code
      });
      
      return { success: true, isSignUpComplete };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const { isSignedIn, nextStep } = await signIn({ 
        username: email, 
        password 
      });
      
      if (isSignedIn) {
        await checkUser();
        return { success: true };
      }
      
      return { success: false, nextStep };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setUser(null);
      setUserProfile(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const initiatePasswordReset = async (email) => {
    try {
      setError(null);
      await resetPassword({ username: email });
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const confirmPasswordReset = async (email, code, newPassword) => {
    try {
      setError(null);
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword
      });
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const changeUsername = async (newUsername) => {
    try {
      setError(null);
      
      // Check if username is available
      const isAvailable = await checkUsernameAvailable(newUsername);
      if (!isAvailable) {
        return { success: false, error: 'Username already taken' };
      }

      // Update username in DynamoDB
      await updateUsername(user.signInDetails.loginId, newUsername);
      
      // Refresh user profile
      await checkUser();
      
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    error,
    signup,
    confirmSignup,
    login,
    logout,
    initiatePasswordReset,
    confirmPasswordReset,
    changeUsername,
    isAuthenticated: !!user,
    isAdmin: userProfile?.isAdmin || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
