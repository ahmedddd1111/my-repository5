import { DataAPIClient } from "@datastax/astra-db-ts";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from 'fs';
import * as path from 'path';
import "dotenv/config";
import axios from 'axios';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,                        
    ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE as string });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 256,
  chunkOverlap: 50
});

const createCollection = async (similarityMetric: SimilarityMetric = "cosine") => {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
        vector: {
            dimension: 768, // Gemini embedding dimension is 768
            metric: similarityMetric
        }
    });
    console.log(res);
};

const WEB_LINKS = [
    "https://hubmarketingagency.com/",
    "https://hubmarketingagency.com/about-company/",
    "https://hubmarketingagency.com/our-services/",
    "https://hubmarketingagency.com/partners/",
    "https://hubmarketingagency.com/portfolio-grid/",
    "https://hubmarketingagency.com/our-team/",
    "https://hubmarketingagency.com/contact/"
];

async function fetchWebPageText(url: string): Promise<string> {
  try {
    const { data } = await axios.get(url, { timeout: 20000 });
    const $ = cheerio.load(data);
    
    // إزالة العناصر غير المرغوب فيها
    $('nav, footer, script, style, iframe, noscript, header, .ad, .ads, .menu, .sidebar, .social-links, .comments, .widget').remove();

    // استهداف العناصر التي تحتوي على المحتوى الرئيسي
    let text = '';
    const contentSelectors = [
      'article', 
      '.post-content', 
      '.entry-content',
      'main', 
      'section', 
      '.content',
      'p',
      'h1, h2, h3, h4, h5, h6'
    ];

    contentSelectors.forEach(selector => {
      $(selector).each((_, element) => {
        const content = $(element).text().trim();
        if (content.length > 20 && !isUnwantedContent(content)) {
          text += content + '\n';
        }
      });
    });

    // تنظيف النص النهائي
    text = text
      .replace(/\s+/g, ' ')
      .replace(/(\n\s*){2,}/g, '\n\n')
      .trim();

    return text || '';
  } catch (error) {
    console.error(`خطأ في جلب أو معالجة الرابط: ${url}`, error);
    return '';
  }
}

function isUnwantedContent(text: string): boolean {
  const unwantedPatterns = [
    /حقوق النشر/i,
    /Copyright/i,
    /©/,
    /تسجيل الدخول/i,
    /login/i,
    /^[\d\s\W]+$/ // المحتوى الذي يحتوي فقط على أرقام ورموز
  ];
  
  return unwantedPatterns.some(pattern => pattern.test(text));
}

const readDataFiles = async () => {
    const dataFolder = path.join(process.cwd(), 'data');
    
    if (!fs.existsSync(dataFolder)) {
        console.error('مجلد data غير موجود! يرجى إنشاؤه وإضافة ملفات txt أو pdf');
        return [];
    }

    const files = fs.readdirSync(dataFolder);
    const txtFiles = files.filter(file => file.endsWith('.txt'));
    const pdfFiles = files.filter(file => file.endsWith('.pdf'));
    
    if (txtFiles.length === 0 && pdfFiles.length === 0) {
        console.error('لا توجد ملفات txt أو pdf في مجلد data');
        return [];
    }

    const fileContents: { filename: string; content: string }[] = [];
    
    for (const file of txtFiles) {
        const filePath = path.join(dataFolder, file);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            fileContents.push({
                filename: file,
                content: content
            });
            console.log(`تم قراءة ملف: ${file}`);
        } catch (error) {
            console.error(`خطأ في قراءة ملف ${file}:`, error);
        }
    }

    for (const file of pdfFiles) {
        const filePath = path.join(dataFolder, file);
        try {
            const data = fs.readFileSync(filePath);
            const pdfData = await pdfParse(data);
            fileContents.push({
                filename: file,
                content: pdfData.text
            });
            console.log(`تم استخراج نص من ملف PDF: ${file}`);
        } catch (error) {
            console.error(`خطأ في قراءة أو معالجة ملف PDF ${file}:`, error);
        }
    }

    for (const url of WEB_LINKS) {
        const webText = await fetchWebPageText(url);
        if (webText && webText.length > 100) {
            fileContents.push({
                filename: `web_${encodeURIComponent(url)}.txt`,
                content: webText
            });
            console.log(`تم جلب محتوى الرابط: ${url}`);
        } else {
            console.warn(`لم يتم العثور على محتوى كافٍ في الرابط: ${url}`);
        }
    }
    
    return fileContents;
};

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION);
    const dataFiles = await readDataFiles();
    
    if (dataFiles.length === 0) {
        console.log('لا توجد بيانات للتحميل');
        return;
    }

    for (const fileData of dataFiles) {
        console.log(`معالجة ملف: ${fileData.filename}`);
        
        const chunks = await splitter.splitText(fileData.content);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            try {
                const { embedding } = await embed({
                    model: google.textEmbeddingModel('text-embedding-004'),
                    value: chunk,
                });

                const vector = embedding;
                
                const res = await collection.insertOne({
                    $vector: vector,
                    text: chunk,
                    filename: fileData.filename,
                    chunk_index: i,
                    created_at: new Date().toISOString()
                });
                
                console.log(`تم إدراج chunk ${i + 1} من ملف ${fileData.filename}`);
            } catch (error) {
                console.error(`خطأ في معالجة chunk ${i + 1} من ملف ${fileData.filename}:`, error);
            }
        }
    }
    
    console.log('تم الانتهاء من تحميل جميع البيانات!');
};

const clearCollection = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        await collection.deleteMany({});
        console.log('تم مسح جميع البيانات من المجموعة');
    } catch (error) {
        console.error('خطأ في مسح البيانات:', error);
    }
};

const main = async () => {
    try {
        console.log('بدء عملية تحميل البيانات...');
        
        await createCollection();
        
        // await clearCollection(); // قم بإلغاء التعليق إذا كنت تريد مسح البيانات القديمة
        
        await loadSampleData();
        
    } catch (error) {
        console.error('خطأ في العملية الرئيسية:', error);
    }
};

main();