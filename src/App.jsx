import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Chat from './pages/Chat';
import Home from './pages/Home';
import CodeCounter from './pages/CodeCounter';
import Navbar from './components/Navbar';
import './index.css';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Chat" element={<Chat/>} />
        <Route path="/CodeCounter" element={<CodeCounter/>} />
      </Routes>
    </Router>
  )
}

export default App