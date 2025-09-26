import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import Navbar from './components/Navbar.jsx';
import './index.css';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Chat />} />
      </Routes>
    </Router>
  )
}

export default App