import { useState } from 'react';
import './App.css';
import ThemeSelector from './components/ThemeSelector';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Library from './pages/Library';
import Sessions from './pages/Sessions';
import Profile from './pages/Profile';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const renderPage = () => {
    switch(currentPage) {
      case 'home':
        return <Home />;
      case 'library':
        return <Library />;
      case 'sessions':
        return <Sessions />;
      case 'profile':
        return <Profile />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Pagebound</h1>
        <p>Read together. Stay in sync. No spoilers.</p>
      </header>
      
<main className="App-main">
  {renderPage()}
</main>
      
      <BottomNav currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

export default App;