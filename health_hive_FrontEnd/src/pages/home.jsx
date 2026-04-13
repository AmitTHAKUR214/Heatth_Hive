import { useState } from "react";
import Sidebar from "../components/Sidebar";
import Searchbar from "../components/Searchbar";
import Navbar from "../components/Navbar";
import AskPost from "../QA/AskPost";
import QuestionsList from "../QA/QuestionsList";
import FilterPopup from "../components/FilterPopup";

export default function Home() {
  const [showAskPost, setShowAskPost] = useState(false);
  const [activeTab, setActiveTab] = useState("ask");
  const [showFilter, setShowFilter] = useState(() => {
    if (sessionStorage.getItem("filter_shown")) return false;
    sessionStorage.setItem("filter_shown", "1");
    return true;
  });

  // console.log("showFilter:", showFilter);
return (


  <div>
      <Navbar />
        <div style={{ display: "flex" , marginTop: "16px"}}>
           <Sidebar />
   
      <main style={{ background:"var(--bg-color-dark)",flex: 1, width:"100%",maxWidth: "1400px", margin: "0 auto" }}>
           
        <Searchbar
          onAsk={() => {
            setActiveTab("ask");
            setShowAskPost(true);
          }}
          onPost={() => {
            setActiveTab("post");
            setShowAskPost(true);
          }}
      />
          {showAskPost && (
              <AskPost
                isOpen={showAskPost}
                activeTab={activeTab}
                onClose={() => setShowAskPost(false)}
              />
          )}

        <div>
            <QuestionsList mode="feed" />
        </div>
      </main>
    </div>
      {showFilter && <FilterPopup onClose={() => setShowFilter(false)} />}
    </div>
  );
}

    