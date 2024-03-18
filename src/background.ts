import tldr from "wikipedia-tldr";
import cheerio from 'cheerio';
import { link } from "fs";

const options = {
  page: 0, 
  safe: false, // Safe Search
  parse_ads: false, // If set to true sponsored results will be parsed
  additional_params: { 
    hl: 'en' 
  }
}

interface SocialLinks {
  [key: string]: string; 
}


let needWikiBio: boolean = false;
let bio: any = null;
let bio_temp: any = null;
let location: string | null = null;

function normalizeString(str) {
    return str.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function extractTwitterUsername(url) {
  const regex = /https?:\/\/twitter\.com\/([^\/\?]+)(\/|\?|$)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}



interface BioAndImage {
  description: string;
  thumbnail: {
    source: string | undefined;
  };
}

async function scrapeLocation(twitter_username: string): Promise<string> {
  try {
    const response = await fetch("https://twstalker.com/"+twitter_username);
    const html = await response.text();
    const $ = cheerio.load(html);

      // Assuming the location is the third <span> following the <h1>
      const location = $('h1').next('span').next('span').next('span').text();

      return location; // Return the location text
  } catch (error) {
      console.error('An error occurred:', error.message);
      throw new Error('Failed to scrape the location');
  }
}


async function scrapeBio(twitter_username: string): Promise<BioAndImage> {
  try {

    const response = await fetch("https://twstalker.com/"+twitter_username);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Assuming there's a single <h1> tag followed by a <span>
    const h1 = $('h1');
    const firstSpanText = h1.next('span').text();

    // Assuming there's a single image with the class "img-thumbnail"
    const imgSrc = $('img.img-thumbnail').attr('src');

    return {
      description: firstSpanText,
      thumbnail: {
        source: imgSrc
      }
    };
  
  } catch (error) {
    console.error('An error occurred:', error.message);
    throw error; // Rethrow the error to handle it outside this function or to let the caller know something went wrong.
  }
}

async function scrapeSearchResults(searchQuery: string): Promise<SocialLinks> {

  let links = {};

  const [firstName, lastName] = searchQuery.split(' ');
  const response = await fetch(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
  const html = await response.text(); // Get the HTML text content of the response
  const $ = cheerio.load(html);

  $('a').each((index, element) => {
    const link = $(element).attr('href') as string; 

    if (link && link.includes('http')) {

      //console.log(link);

      const linkedinProfileRegex = /https?:\/\/[a-zA-Z]{2,3}\.linkedin\.com\/in\/[a-zA-Z0-9\-_]+\/?(\?.*)?$/;

      const twitterProfileRegex = /https?:\/\/twitter\.com\/[a-zA-Z0-9_]+\/?(\?.*)?$/;
      
      const facebookProfileRegex = /https?:\/\/[a-zA-Z]{2,3}\.facebook\.com\/[a-zA-Z0-9\-_]+\/?(\?.*)?$/;
      
      const instagramProfileRegex = /https?:\/\/[a-zA-Z]{2,3}\.instagram\.com\/[a-zA-Z0-9\-_]+\/?(\?.*)?$/;      

      if (link.includes('linkedin') && !links['linkedin'] && linkedinProfileRegex.test(link)){
        links['linkedin'] = link;
      }

      if (link.includes('twitter') && !links['twitter'] && twitterProfileRegex.test(link)){
        links['twitter'] = link;
      }

      if (link.includes('facebook') && !links['facebook'] && facebookProfileRegex.test(link)){
        links['facebook'] = link;
      }

      if (link.includes('instagram') && !links['instagram'] && instagramProfileRegex.test(link)){
        links['instagram'] = link;
      }

      if(link.includes('wikipedia') && !needWikiBio){
        needWikiBio = true;
      }

      if (!links['personal']) {
        try {
          // Parse the link to get a URL object
          const urlObj = new URL(link);
          const hostname = urlObj.hostname;
      
          // Check if the hostname includes the first name or last name
          if (hostname.includes(firstName.toLowerCase()) || hostname.includes(lastName.toLowerCase())) {
            links['personal'] = link;
          }
        } catch (error) {
          console.error("Error parsing URL:", error);
        }
      }
      
    }
});

  return links;
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'wiki-query') {
    const query = normalizeString(message.text); 
    //console.log(query);

    try {
      const searchResults = await scrapeSearchResults(query); 

      if(needWikiBio){
        try{
          bio = await tldr(query);
        }
        catch(error){
          console.error('An error occurred while scraping wiki:', error);
        }
        needWikiBio = false;
        if (bio.description === "Topics referred to by the same term") {
          bio = null;
        }
        if (bio == null || bio.thumbnail == undefined ) {
          if (bio != null) {
            bio_temp = bio;
          }
          try {
            let twitter_username = extractTwitterUsername(searchResults['twitter']);
            //console.log('Twitter Username:', twitter_username);
            bio = await scrapeBio(twitter_username);
          } catch (error) {
            console.error('Scraping Twitter failed:', error);
          }
          if (bio_temp != null) {
            bio.description = bio_temp.description;
          }
        }

      } else if(searchResults['twitter']){
        try {
          let twitter_username = extractTwitterUsername(searchResults['twitter']);
          bio = await scrapeBio(twitter_username);
          //console.log('Bio Text:', bio.description);
          //console.log('Image URL:', bio.thumbnail);
        } catch (error) {
          console.error('Scraping Twitter failed:', error);
        }
      }
      else{
        bio = null;
      }


      // location
      if(searchResults['twitter']){
        try {
          let twitter_username = extractTwitterUsername(searchResults['twitter']);
          location = await scrapeLocation(twitter_username);
          //console.log(location)
        } catch (error) {
          console.error('Scraping Location failed:', error);
        }
      }

      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'wiki-query-response',
        title: query,
        description: searchResults,
        bio: bio,
        location: location
      });

    } catch (error) {
      console.error('An error occurred while scraping search results:', error);

      // Send an error message back to the content script in case of failure
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'wiki-query-response',
        title: query,
        error: 'Failed to scrape search results.'
      });
    }
  }

  // Return true to indicate that you're asynchronously sending a response
  return true;
});
