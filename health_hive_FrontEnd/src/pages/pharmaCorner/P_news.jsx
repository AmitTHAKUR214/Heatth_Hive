import { Link, Navigate } from "react-router-dom";
import { getPUser } from "../../api/authapi";
import "./P_news.css";

const P_news = () => {
  const user = getPUser();


  return (
    <div className="insights-wrapper">
      {/* Latest News */}
      <button className="insight-card">
        <h3>Latest News</h3>
        <ul>
          <li>New medicine pricing policy announced</li>
          <li>Cold & flu medicines trending this season</li>
          <li>Regulatory update on antibiotics</li>
        </ul>
      </button>
      <br className="br"/>
      {/* Trending Medicines */}
      <button className="insight-card">
        <h3>Trending Medicines</h3>
        <ul>
          <li>Paracetamol</li>
          <li>Azithromycin</li>
          <li>Vitamin D3</li>
        </ul>
      </button>
      <br className="br"/>

      {/* Most Searched */}
      <button className="insight-card">
        <h3>Most Searched</h3>
        <ol>
          <li>Insulin</li>
          <li>BP Medicines</li>
          <li>Antibiotics</li>
        </ol>
      </button>
    </div>
  );
};

export default P_news;
