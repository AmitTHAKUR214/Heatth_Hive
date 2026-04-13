  import React from 'react'
  import QuestionsList from '../QA/QuestionsList'
  import MiniQuestionsList from '../QA/MiniQuestionsList'
  import Navbar from '../components/Navbar'
  import "../QA/QuestionsList.css"
  import Searchbar from '../components/Searchbar';

  // console.log("ANSWERS PAGE RENDERED");

  export default function Answers({onAsk, onPost}) {
    return (
      <>
      <Navbar />
      <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>       
        <section 
        style={{maxWidth:"700px",width:"100%"}}
        className='search_bar_container'>
          <Searchbar />
        </section>

      <div style={{ display: "flex" }}>
        <section className='question-for-u'>
          <h2 style={{ marginLeft: "20px" }} className="qa-title">Questions for you</h2>
          <QuestionsList mode="question" sortBy="recent" />
        </section>

        <section className='trending-question' style={{ position: "sticky", top: "80px", alignSelf: "flex-start" }}>
          <h2 style={{ marginLeft: "20px" }} className="qa-title">Trending</h2>
          <div style={{ maxHeight: "700px", overflowY: "scroll", marginTop: "12px" }}>
            <MiniQuestionsList mode="question" sortBy="likes" />
          </div>
        </section>
      </div>
        
      </div>
      </>
    )
  }


