// TODO: Implement the chat API with Groq and web scraping with Cheerio and Puppeteer
// Refer to the Next.js Docs on how to read the Request body: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
// Refer to the Groq SDK here on how to use an LLM: https://www.npmjs.com/package/groq-sdk
// Refer to the Cheerio docs here on how to parse HTML: https://cheerio.js.org/docs/basics/loading
// Refer to Puppeteer docs here: https://pptr.dev/guides/what-is-puppeteer
import Groq from 'groq-sdk';
import axios from 'axios';
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

const client = new Groq({
  apiKey: process.env['GROQ_API_KEY'], // This is the default and can be omitted
});

async function scrape_LLM_response(prompt: string,URL: string) {
  //check if in cache first, if so return cached response
  const cachedResponse = await redis.get(URL)
  if (cachedResponse){
    return cachedResponse
  }
  //if not perform scraping, llm completion and then cache result
  const finalURL = `https://r.jina.ai/${URL}`
  const JINA_API_KEY = process.env['JINA_API_KEY'];
  const response = await axios.post(finalURL, null, {
    headers: {
      Authorization: `Bearer ${JINA_API_KEY}`,
    },
  });
   const website_data = response.data; 
  
   const query = `Do this${prompt} Here is the website data: ${website_data}`
   
   try{
   const chatCompletion = await client.chat.completions.create({
    messages: [{role:'system',content:query}],
    model: 'llama3-8b-8192',})
    //cache the response for future use
    const res = chatCompletion.choices[0].message.content
    await redis.set(URL,res,{ex:604800})
    return res
  }
  catch(error: any){
    //the article exceeds context window, so we recursively call a function with a smaller chunk size
     


        const chunkSize = 20000
        const responses = []
        for (let i = 0; i < website_data.length; i += chunkSize) {
          const chunk = website_data.slice(i, i + chunkSize)
          const query = `Do this${prompt} Here is the website data: ${chunk}`
          const chatCompletion = await client.chat.completions.create({
            messages: [{role:'system',content:query}],
            model: 'llama3-8b-8192',
          })
          responses.push(chatCompletion.choices[0].message.content)
        }
        //cache the response for future use
        const result = responses.join('\n\n')
        await redis.set(URL,result,{ex:604800})
        return result
       

        
      
    

    
  }
}

function ExtractWebsite(prompt:string){
  //   / means delimiter   ? means optional so s is optional.    /\ means slash
  //  ^ means negate  and \s means whitespace + means one or more  so [^\s]+ means 1 more occurances of anything not a white space.
  //   /g means global so it will match all occurences
  const websites = prompt.match(/(https?:\/\/[^\s]+)/g);
  //if websites found then return them else return null
  return websites ? websites : null
}
export async function POST(req: Request) {
  let { context } = await req.json()
  //to scrape a website we need to check latest message and see if it has a .com .org  .net or others
  const lastMessage = context[context.length - 1].content
  const non_url_prompt = lastMessage.replace(/(https?:\/\/[^\s]+)/g,'')
  const websites = ExtractWebsite(lastMessage)
  if(websites){
    //this way its done asyncrhonously over a simple for loop
    //Here we scrape the website and get an LLM to give us response to original prompt for each website
    const websiteDataResponses = await Promise.all(websites.map(async(website)=>{
      const scraped_data = await scrape_LLM_response(non_url_prompt,website)
      return scraped_data
    }))
    //combine the seprate LLM responses per URL into 1 message
    //need a better delimiter bc /n is not creating new lines
    const combinedMessage  = websiteDataResponses.join('--------------------------------------\n\n')
    return new Response(JSON.stringify({message:combinedMessage}))

    
  }

  //if not websites we let the LLM answer the general question with its known context
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: context,
      model: 'llama3-8b-8192',
    });
      //JSON.stringify turns javascript objects into JSON text
      return new Response(JSON.stringify({message:chatCompletion.choices[0].message.content}))
  } catch (error) {

    console.log(error)
    return new Response(JSON.stringify({message:"Error"}))
  }
}
