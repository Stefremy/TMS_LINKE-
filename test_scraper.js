const https = require('https');

https.get('https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=EQ418725876PT', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    // try to find the tracking events in the HTML
    // usually in a class like .timeline or .tracking-details
    const matches = data.match(/<div class="status-name">(.*?)<\/div>/g) || data.match(/<td>(.*?)<\/td>/g);
    console.log(matches ? matches.slice(0, 10) : "No matches found");
    
    // just dump some of the table structure if possible
    const timelineMatches = data.match(/<ul class="timeline(.*?)>(.*?)<\/ul>/s);
    if(timelineMatches) {
        console.log("Found timeline");
    } else {
        const trMatches = data.match(/<tr(.*?)>(.*?)<\/tr>/gs);
        console.log("Found rows:", trMatches ? trMatches.length : 0);
    }
  });
}).on('error', (err) => console.error(err));
