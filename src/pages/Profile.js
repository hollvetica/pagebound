import React from 'react';
import ThemeSelector from '../components/ThemeSelector';

function Profile() {
  return (
    <div className="page">
      <h2>Profile</h2>
      <p>Customize your reading experience</p>
      
      <ThemeSelector />
    </div>
  );
}

export default Profile;