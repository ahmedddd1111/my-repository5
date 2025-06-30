import { DataAPIClient } from "@datastax/astra-db-ts";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as fs from 'fs';
import * as path from 'path';
import "dotenv/config";

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
    chunkSize: 512,
    chunkOverlap: 100
});

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
        vector: {
            dimension: 768, // Gemini embedding dimension is 768
            metric: similarityMetric
        }
    });
    console.log(res);
};

// قراءة جميع ملفات txt من مجلد data
const readDataFiles = async () => {
    const dataFolder = path.join(process.cwd(), 'data');
    
    // التأكد من وجود مجلد data
    if (!fs.existsSync(dataFolder)) {
        console.error('مجلد data غير موجود! يرجى إنشاؤه وإضافة ملفات txt');
        return [];
    }

    const files = fs.readdirSync(dataFolder);
    const txtFiles = files.filter(file => file.endsWith('.txt'));
    
    if (txtFiles.length === 0) {
        console.error('لا توجد ملفات txt في مجلد data');
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
        
        // تقسيم المحتوى إلى chunks
        const chunks = await splitter.splitText(fileData.content);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            try {
                // استخدام Gemini للـ embedding
                const { embedding } = await embed({
                    model: google.textEmbeddingModel('text-embedding-004'),
                    value: chunk,
                });

                const vector = embedding;
                
                // إدراج البيانات مع معلومات إضافية
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

// دالة لمسح البيانات الموجودة (اختيارية)
const clearCollection = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        await collection.deleteMany({});
        console.log('تم مسح جميع البيانات من المجموعة');
    } catch (error) {
        console.error('خطأ في مسح البيانات:', error);
    }
};

// دالة رئيسية للتشغيل
const main = async () => {
    try {
        console.log('بدء عملية تحميل البيانات...');
        
        // إنشاء المجموعة (إذا لم تكن موجودة)
        await createCollection();
        
        // مسح البيانات القديمة (اختياري - احذف هذا السطر إذا كنت تريد إضافة بيانات جديدة فقط)
        // await clearCollection();
        
        // تحميل البيانات الجديدة
        await loadSampleData();
        
    } catch (error) {
        console.error('خطأ في العملية الرئيسية:', error);
    }
};

// تشغيل الكود
main();