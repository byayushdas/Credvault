export const getData = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(`credvault_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading ${key} from localStorage`, error);
    return defaultValue;
  }
};

export const setData = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(`credvault_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage`, error);
  }
};

export const removeData = (key: string): void => {
  try {
    localStorage.removeItem(`credvault_${key}`);
  } catch (error) {
    console.error(`Error removing ${key} from localStorage`, error);
  }
};

export const resetDemoData = (): void => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('credvault_')) {
      localStorage.removeItem(key);
    }
  });
  window.location.reload();
};
