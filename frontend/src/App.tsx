import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css'
import { Dashboard } from './components/ui/dashboard';

function App() {

  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />

        </Routes>
      </Router>
    </>
  )
}

export default App
