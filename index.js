// import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
// import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
// import { TextLoader } from 'langchain/document_loaders/fs/text';
// import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
require('dotenv').config();
const
  SUPABASE_URL = process.env.SUPABASE_URL,
  SUPABASE_KEY = process.env.SUPABASE_KEY,
  OPENAI_KEY = process.env.OPENAI_KEY,
  SECRET_KEY = process.env.SECRET_KEY,
  USER = process.env.USER,
  PASSWORD = process.env.PASSWORD;


let { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
let { OpenAIEmbeddings } = require('langchain/embeddings/openai');
let { PDFLoader } = require('langchain/document_loaders/fs/pdf');
let { TextLoader } = require('langchain/document_loaders/fs/text');
let { CSVLoader } = require("langchain/document_loaders/fs/csv");
let { DirectoryLoader } = require('langchain/document_loaders/fs/directory');

const express = require('express'),
  app = express(),
  bodyParser = require('body-parser'),
  cors = require('cors'),
  fileUpload = require("express-fileupload"),
  fetch = require('node-fetch'),
  cheerio = require('cheerio'),
  path = require('path');

let { createClient } = require('@supabase/supabase-js');
const { unlink } = require('fs');



//console.log(SUPABASE_URL, SUPABASE_KEY)
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

  const embeddings = new OpenAIEmbeddings({openAIApiKey: OPENAI_API_KEY});

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

async function preprocess(text) {
  return new Promise(async (resolve, reject) => {
  console.log(text)
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await textSplitter.splitText(text);
  console.log('split docs', docs);

  const embeddings = new OpenAIEmbeddings({openAIApiKey: OPENAI_KEY});

  docs.forEach(async (doc) => {
    console.log(doc)
    doc = doc.replace(/\n/g, ' ')
    let embedding = await embeddings.embedQuery(doc)

    await supabaseClient.from('documents').insert({
     content: doc,
     embedding
    })

  });
  resolve('success')
  })
}

async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    let updest = __dirname + "/docs/" + file.name
    file.mv(updest, err => {
      if (err) {
        console.log(err)
        return 'err'
      }

      //return 'success';
      resolve('success')
    });

  })
}

async function splitFile(p, updest) {
  return new Promise(async (resolve, reject) => {
    /*load raw docs from the all files in the directory */
    const directoryLoader = new DirectoryLoader(p, {
      '.pdf': (path) => new PDFLoader(path),
      ".txt": (path) => new TextLoader(path),
      ".csv": (path) => new CSVLoader(path),
    });

    // const loader = new PDFLoader(filePath);
    const rawDocs = await directoryLoader.load();
    //console.log(rawDocs)
    /* Split text into chunks */
    // const textSplitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 1000,
    //   chunkOverlap: 200,
    // });

    //const docs = await textSplitter.splitDocuments(rawDocs);
   // console.log('split docs', docs);
    unlink(updest, (err) => {
      if (err) {
        console.error(err)
        return
      }
    })
    resolve(rawDocs);
  })
}
async function askQuestion(question) {

  let ask = question
  const { data } = await supabaseClient.functions.invoke('ask-me', {
    body: JSON.stringify({
      query: ask
    })
  })
  console.log(ask)
  console.log(data)
  return data
}

app.use(express.static('/html'))
app.use(bodyParser.json())
app.use(cors())
app.use(fileUpload());
app.use('/assets', express.static(path.join(__dirname, 'html/assets')))
app.get('/', (req, res) => { res.sendFile(path.join(__dirname + '/html/index.html')); })

app.post('/ask', async (req, res) => {
console.log(req.body.key, SECRET_KEY)
  if (!req.body) return res.sendStatus(400)
  if (!req.body.key || req.body.key != SECRET_KEY) return res.sendStatus(401)

  let question = req.body.question;
  let data = await askQuestion(question);
  res.send(data);
})

app.post('/uploadFile', async (req, res) => {
console.log(req.body.key, SECRET_KEY)
  if (!req.body) return res.sendStatus(400)
  if (!req.body.key || req.body.key != SECRET_KEY) return res.sendStatus(401)

  let file = req.files.files;
  let updest = __dirname + "/docs/" + file.name

  await uploadFile(file)

  let data = await splitFile(__dirname + "/docs/", updest)
  let sendingData = [];
  data.forEach((doc) => sendingData.push(doc.pageContent))

  res.send(sendingData)
})

app.post('/createBindings', async (req, res) => {
  if (!req.body) return res.sendStatus(400)
  if (!req.body.key || req.body.key != SECRET_KEY) return res.sendStatus(401)

  let text = req.body.text;

  let data = await preprocess(text);
  res.send(data);
})

app.get('/login/:buff', (req, res) => {
  let buff = req.params.buff;
  console.log(buff)
  console.log(new Buffer.from(`${USER}:${PASSWORD}`).toString('base64'))
  console.log(buff == new Buffer.from(`${USER}:${PASSWORD}`).toString('base64'))
  if (buff == new Buffer.from(`${USER}:${PASSWORD}`).toString('base64')) {
    res.send(true)
  }else{
    res.send(false)
  }
})

app.post('/scrape', async (req, res) => {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  let url = req.body.url;
  console.log(url)
  let data = await fetch(url,{
    headers:{
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      "rejectUnauthorized": false
    },
    strictSSL: false
  })
  .then(res => res.text())
  .then(body => {
    const html = body;
    const extractedText = extractTextFromHTML(html);
    res.send(extractedText)
  });
  
})

const extractTextFromHTML = (html) => {
  const $ = cheerio.load(html);
  const output = [];

  // Function to add text to the output array
  const addToOutput = (text) => {
    output.push(text.trim());
  };

  // Scan each tag in the document
  $('*').each((index, element) => {
    const tagName = $(element).prop('tagName').toLowerCase();
    if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6' || tagName === 'p' || tagName === 'pre' || tagName === 'blockquote') {
      addToOutput($(element).text());
    }
  });

  return output.join('\n');
};

app.listen(3000, () => {
  console.log('Listening on port 3000')
})