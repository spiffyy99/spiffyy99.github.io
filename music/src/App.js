import "@/App.css";
import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Setup from "./pages/Setup";
import Game from "./pages/Game";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <div className="App">
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/setup" element={<Setup />} />
          <Route path="/game" element={<Game />} />
          <Route path="/results" element={<Results />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </HashRouter>
    </div>
  );
}

export default App;
