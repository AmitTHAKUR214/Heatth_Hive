import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./css/Searchbar.css";

export default function Searchbar({ onAsk, onPost}) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();


   const handleSearch = (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="searchbar-wrapper" onSubmit={handleSearch}>
      {/* Search input */}
      <form className="searchbar">
        {/* <span className="avatar">👤</span> */}
        <input
          type="text"
          title="Search something"
          placeholder="What do you want to ask or share?"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="submit-btn" type="submit"><i className="fas fa-search"></i></button>
      </form>

      {/* Action row */}    
     <div className="search-actions">
      <button title="Ask something"
       onClick={onAsk}>Ask</button>
      <button title="Answer some questions"
       onClick={() => navigate("/QA/answer")}>Answer</button>
      <button title="Share something"
       onClick={onPost}>Post</button>
    </div>

    </div>
  );
}
