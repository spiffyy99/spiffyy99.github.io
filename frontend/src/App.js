import "@/App.css";
import React, { createContext, useContext, useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Setup from "@/pages/Setup";
import Game from "@/pages/Game";
import Results from "@/pages/Results";

export const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

function App() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => setIsDark(prev => !prev) }}>
      <div className="App">
        <HashRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/game" element={<Game />} />
            <Route path="/results" element={<Results />} />
          </Routes>
        </HashRouter>
      </div>
    </ThemeContext.Provider>
  );
}

export default App;
