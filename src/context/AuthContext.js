import React, { createContext, useState, useContext, useEffect } from 'react';
import { getCurrentUser, signIn, signUp, signOut, confirmSignUp, resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { fetchUserProfile, updateUsername, checkUsernameAvailable } from '../utils/userService';
import { getAvatarUploadUrl, uploadAvatarToS3, confirmAvatarUpload, updateProfile } from '../utils/profileService';
import { isPreviewMode } from '../utils/previewMode';

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
    // Dev-only UI preview (see utils/previewMode.js)
    if (isPreviewMode()) {
      setUser({ userId: 'preview-user', signInDetails: { loginId: 'preview@pagebound.test' } });
      setUserProfile({ userId: 'preview-user', email: 'preview@pagebound.test', username: 'hollie', tagline: 'Reading slowly, on purpose.', isAdmin: false });
      setLoading(false);
      return;
    }

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
      // Skip username check - will validate during signup
      //const isAvailable = await checkUsernameAvailable(username);
      //if (!isAvailable) {
      //  return { success: false, error: 'Username already taken' };
      //}

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
      // User profile will be created by Lambda post-confirmation trigger
      // await createUserProfile(email, username);

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

  const updateProfilePhoto = async (file) => {
    try {
      setError(null);

      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        return { success: false, error: 'Image must be less than 5MB' };
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        return { success: false, error: 'File must be an image' };
      }

      // Get presigned URL
      const { uploadUrl, imageUrl } = await getAvatarUploadUrl(
        user.signInDetails.loginId,
        file.type
      );

      // Upload to S3
      await uploadAvatarToS3(uploadUrl, file);

      // Confirm and update DB
      await confirmAvatarUpload(user.signInDetails.loginId, imageUrl);

      // Refresh profile
      await checkUser();

      return { success: true, imageUrl };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      setError(null);

      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Validate updates
      if (updates.tagline && updates.tagline.length > 255) {
        return { success: false, error: 'Tagline must be 255 characters or less' };
      }

      if (updates.favoriteBooks && updates.favoriteBooks.length > 10) {
        return { success: false, error: 'Cannot have more than 10 favorite books' };
      }

      await updateProfile(user.signInDetails.loginId, updates);
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
    updateProfilePhoto,
    updateUserProfile,
    checkUser,
    isAuthenticated: !!user,
    isAdmin: userProfile?.isAdmin || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
