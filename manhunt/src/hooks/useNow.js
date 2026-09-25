import { useEffect, useState } from 'react';

// Server-aligned "now" that re-renders every `interval` ms.
export function useNow(offset = 0, interval = 250) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), interval);
    return () => clearInterval(id);
  }, [offset, interval]);
  return now;
}
