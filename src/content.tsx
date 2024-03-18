import cssText from "data-text:~style.css";
import { useEffect, useState } from "react";
import nlp from 'compromise';
import type { PlasmoCSConfig } from "plasmo"
import { FaSquareInstagram, FaSquareXTwitter, FaLinkedin } from "react-icons/fa6";
import { FaMapMarkerAlt } from "react-icons/fa";
import { FaFacebookSquare } from "react-icons/fa";
import { BsWindow } from "react-icons/bs";

export const getStyle = () => {
  const style = document.createElement("style");
  style.textContent = cssText;
  return style;
}

export const config: PlasmoCSConfig = {
  css: ["font.css"]
}

const iconMap = {
  instagram: FaSquareInstagram,
  twitter: FaSquareXTwitter,
  linkedin: FaLinkedin,
  facebook: FaFacebookSquare,
  personal: BsWindow
};


type Socials = {
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  facebook?: string;
  personal?: string;
};

function removeTextWithinParentheses(input: string): string {
  return input.replace(/\([^)]*\)/g, '');
}

const keyOrder = ['linkedin', 'twitter', 'facebook', 'instagram', 'personal'];

const PlasmoOverlay = () => {
  const [wikiTldr, setWikiTldr] = useState(null);
  const [wikiTldrDesc, setWikiTldrDesc] = useState<Socials| null>(null);
  const [wikiTldrBio, setWikiTldrBio] = useState(null);
  const [wikiTldrLocation, setWikiTldrLocation] = useState(null);
  const [showButton, setShowButton] = useState(false);
  const [showLoading, setLoading] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const messageListener = (message) => {
      if (message.type === "wiki-query-response") {
        console.log(message);
        setWikiTldr(message.title);
        setWikiTldrDesc(message.description);
        setWikiTldrBio(message.bio);
        setWikiTldrLocation(message.location);
        setLoading(false);
        setShowButton(false);
      }
    };

    const selectionChangeListener = () => {
      const selectedText = window.getSelection().toString().trim();
      let doc = nlp(selectedText);
      const names = doc.people().out('array');
      if ((selectedText.length > 0 && names.length === 1 && selectedText.split(/\s+/).length <= 3) || (/^[A-Z][a-z]+\s[A-Z][a-zA-Z]+$/.test(selectedText))) {
        const range = window.getSelection().getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setButtonPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX
        });
        setShowButton(true);
      } else {
        setShowButton(false);
      }
    };

    const clickListener = (e) => {
      if (e.target.tagName !== "PLASMO-CSUI") {
        setWikiTldr(null);
        setWikiTldrDesc(null);
        setWikiTldrBio(null);
        setWikiTldrLocation(null);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    document.addEventListener('mouseup', selectionChangeListener);
    document.addEventListener('selectionchange', selectionChangeListener);
    document.addEventListener('click', clickListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      document.removeEventListener('mouseup', selectionChangeListener);
      document.removeEventListener('selectionchange', selectionChangeListener);
      document.removeEventListener('click', clickListener);
    };
  }, []);

  const handleButtonClick = () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
      // Send selected text to background script for processing
      chrome.runtime.sendMessage({ type: 'wiki-query', text: selectedText });
      setLoading(true);
    }
  };

  return (
    <>
      {showButton && (
        <button
          style={{ position: 'absolute', top: `${buttonPosition.top + 5}px`, left: `${buttonPosition.left}px`, zIndex: 9000}}
          className="lookup-button bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2 px-4 border border-gray-300 rounded shadow select-none "
          onClick={handleButtonClick}>
          {showLoading ? "Loading..." : "Lookup"}
          </button>
      )}
      
      {wikiTldr && (
        <div 
    style={{ top: `${buttonPosition.top + 5}px`, left: `${buttonPosition.left}px`, position: 'absolute', zIndex: 9999,  width: 'max-content', maxWidth: '20vw', overflowWrap: 'break-word'}}
    className="block p-6 bg-white rounded-lg border border-gray-300 shadow-md dark:bg-gray-800 dark:border-gray-700"
  >
    
    <h1
     className="query-name font-sans font-bold tracking-tight text-gray-900 dark:text-white select-none">
      {wikiTldr}
    </h1>

    {wikiTldrBio && (
  <div className="bio mt-2">
    {wikiTldrBio.thumbnail && (
      <img
        src={wikiTldrBio.thumbnail.source}
        alt={wikiTldrBio.title || "Thumbnail"}
        className="thumbnail mr-2 float-left w-20 h-20 object-cover rounded border-gray-100" // Adjust the size and styling as needed
      />
    )}
    <h2 className="font-bold tracking-tight text-gray-600 dark:text-white">
      {removeTextWithinParentheses(wikiTldrBio.description)}
    </h2>
    <div style={{ clear: 'both' }}></div>
  </div>
)}

<div className="info-container flex items-center mt-3 justify-start">
  <div className="location-info flex items-center mr-4"> {/* Add some margin to the right of the location info */}
    <FaMapMarkerAlt size="18px" className="text-red-500 mr-1" /> {/* Adjust the color and margin as needed */}
    <span className="text-gray-700 dark:text-gray-400">{wikiTldrLocation}</span>
  </div>

  <ul className="social-icons font-normal text-gray-700 dark:text-gray-400 select-text flex">
    {keyOrder.map((platform) => {
      const url = wikiTldrDesc[platform];
      const IconComponent = iconMap[platform];

      return url ? (
        <li key={platform} className="mr-3">
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-800 transition duration-300">
            {IconComponent && <IconComponent size="24px" />}
          </a>
        </li>
      ) : null;
    })}
  </ul>
</div>
  </div>
)}
    </>
  );
}

export default PlasmoOverlay;
