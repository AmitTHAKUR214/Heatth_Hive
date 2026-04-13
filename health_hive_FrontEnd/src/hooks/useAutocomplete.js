import { useState, useRef } from "react";

export default function useAutocomplete({
  fetcher,
  minLength = 2,
  delay = 300,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const debounceRef = useRef(null);

  const handleChange = (value) => {
    setQuery(value);
    setIsValid(false);
    setShowResults(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < minLength) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetcher(value);
        setResults(data);
      } catch (err) {
        console.error("Autocomplete error:", err);
        setResults([]);
      }
    }, delay);
  };

  const handleSelect = (item, labelExtractor) => {
    setQuery(labelExtractor(item));
    setResults([]);
    setShowResults(false);
    setIsValid(true);
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
    setIsValid(false);
  };

  return {
    query,
    results,
    showResults,
    isValid,
    setShowResults,
    handleChange,
    handleSelect,
    clear,
  };
}


// This hook is:
// Debounced
// API-agnostic
// UI-agnostic
// Production-grade