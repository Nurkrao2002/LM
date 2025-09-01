import { createContext, useContext, useEffect, useState } from 'react';

export const themes = {
  light: {
    name: 'light',
    colors: {
      background: 'gray-50',
      surface: 'white',
      surfaceHover: 'gray-50',
      text: {
        primary: 'gray-900',
        secondary: 'gray-600',
        muted: 'gray-500'
      },
      border: 'gray-200',
      accent: {
        primary: 'indigo-600',
        primaryHover: 'indigo-700',
        secondary: 'indigo-100',
        text: 'indigo-600'
      }
    }
  },
  dark: {
    name: 'dark',
    colors: {
      background: 'gray-900',
      surface: 'gray-800',
      surfaceHover: 'gray-700',
      text: {
        primary: 'white',
        secondary: 'gray-300',
        muted: 'gray-400'
      },
      border: 'gray-700',
      accent: {
        primary: 'indigo-500',
        primaryHover: 'indigo-600',
        secondary: 'indigo-900',
        text: 'indigo-400'
      }
    }
  }
};

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('user-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme = systemPrefersDark ? 'dark' : 'light';
      setCurrentTheme(initialTheme);
    }
    setIsLoading(false);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.className = root.className.replace(/\btheme-\w+/g, '');
    root.classList.add(`theme-${currentTheme}`);

    // Save to localStorage
    localStorage.setItem('user-theme', currentTheme);
  }, [currentTheme]);

  const switchTheme = (theme) => {
    if (themes[theme]) {
      setCurrentTheme(theme);
    }
  };

  const getTheme = () => {
    return themes[currentTheme] || themes.light;
  };

  const value = {
    currentTheme,
    switchTheme,
    getTheme,
    isLoading,
    themes
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};