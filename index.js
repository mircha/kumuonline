// import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
// import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
// import { TextLoader } from 'langchain/document_loaders/fs/text';
// import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
require('dotenv').config();
const 
    SUPABASE_URL = process.env.SUPABASE_URL,
    SUPABASE_KEY = process.env.SUPABASE_KEY;


let { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
let { OpenAIEmbeddings } = require('langchain/embeddings/openai');
let { PDFLoader } = require('langchain/document_loaders/fs/pdf');
let { TextLoader } = require('langchain/document_loaders/fs/text');
let { DirectoryLoader } = require('langchain/document_loaders/fs/directory');

const express = require('express'),
  app = express(),
  path = require('path');

let { createClient } = require('@supabase/supabase-js')



console.log(SUPABASE_URL, SUPABASE_KEY)
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const filePath = './docs';

const split = async () => {
  // const directoryLoader = new DirectoryLoader(filePath, {
  //     '.txt': (path) => new TextLoader(path),
  // });

  /*load raw docs from the all files in the directory */
  const directoryLoader = new DirectoryLoader(filePath, {
    '.pdf': (path) => new PDFLoader(path),
  });

  // const loader = new PDFLoader(filePath);
  const rawDocs = await directoryLoader.load();

  /* Split text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitDocuments(rawDocs);
  //console.log('split docs', docs);

  const embeddings = new OpenAIEmbeddings();

  docs.forEach(async (doc) => {
    doc.pageContent = doc.pageContent.replace(/\n/g, ' ')
    let embedding = await embeddings.embedQuery(doc.pageContent)

    await supabaseClient.from('documents').insert({
      content: doc.pageContent,
      embedding
    })

  });



  // console.log(docs[0].pageContent)
  // const docEmbeddings = await embeddings.embedDocuments(docs[0].pageContent);
  // console.log('doc embeddings', docEmbeddings);

  //console.log(await embeddings.embedQuery(docs[0].pageContent))
};

//split();

async function askQuestion() {

  let ask = "1+1"
      const {data} = await supabaseClient.functions.invoke('ask-me', {
          body: JSON.stringify({
              query: ask
          })
      })
      console.log(ask)
      console.log(data)
      return data
  }

app.use(express.static('/html'))
app.get('/', (req, res) => { res.sendFile(path.join(__dirname + '/html/test.html')); })
app.get('/ask', async (req, res) => { let data = await askQuestion(); res.send(data); })

app.listen(3000, () => {
  console.log('Listening on port 3000')
})