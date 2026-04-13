import { useState, useEffect } from "react";
import "./css/ImageLightBox.css"
import Item from "antd/es/list/Item";

export default function ImageLightbox({
   images,
   title, 
   initialIndex = 0, 
   onClose 
  }) {
  const [current, setCurrent] = useState(initialIndex);

  // 🔒 LOCK SCROLL
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);
// this cute component above makes acroll in the back disable, literally ....
  


  if (!images || images.length === 0) return null;

  const nextImage = () => setCurrent((current + 1) % images.length);
  const prevImage = () =>
    setCurrent((current - 1 + images.length) % images.length);

  return (
    <div className="lightbox-overlay" 
          onClick= {(e) => {
            e.stopPropagation(); // prevent parent Link
            onClose();
          }}>
      <div
        className="lightbox-content"
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking image
>
        {/* <button className="lightbox-close" onClick={onClose}>
          ✕
        </button> */}
        {/* i thought that clicking outside the image was good to make it go back rather than clicking on the cross */}
        
        
        <button className="lightbox-arrow left" onClick={prevImage}>
          ‹
        </button>

        <section className="Lightbox-image-container">
          <div className="lightbox-counter">
            {current + 1} / {images.length}
          </div>
          <img 
            loading="lazy"
            src={images[current].path}
            alt={`Image ${current + 1}`} 
            className="lightbox-image"
          ></img>
           {/* 🔹 HEADER */}
          {title && (
            <div className="lightbox-header">
              <span className="lightbox-title">Posted By: {images.title}</span>
            </div>
          )}
         
        </section>           
          <button className="lightbox-arrow right" onClick={nextImage}>
            ›
          </button>
      </div>
    </div>
  );
}
