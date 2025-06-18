import { DataAPIClient } from "@datastax/astra-db-ts";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

// مجلد الـ PDF files
const DATA_FOLDER = path.join(process.cwd(), "data");

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE as string });

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // زيادة حجم الـ chunk للـ cybersecurity content
    chunkOverlap: 200
});

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
    try {
        const res = await db.createCollection(ASTRA_DB_COLLECTION, {
            vector: {
                dimension: 768, // Gemini embedding dimension is 768
                metric: similarityMetric
            }
        });
        console.log("Collection created successfully:", res);
    } catch (error) {
        console.log("Collection might already exist or error occurred:", error);
    }
};

// دالة لقراءة جميع ملفات PDF من مجلد data
const getPDFFiles = (): string[] => {
    if (!fs.existsSync(DATA_FOLDER)) {
        console.error(`Data folder not found: ${DATA_FOLDER}`);
        return [];
    }
    
    const files = fs.readdirSync(DATA_FOLDER);
    const pdfFiles = files.filter(file => 
        path.extname(file).toLowerCase() === '.pdf'
    );
    
    console.log(`Found ${pdfFiles.length} PDF files:`, pdfFiles);
    return pdfFiles.map(file => path.join(DATA_FOLDER, file));
};

// دالة لتحميل وتحليل ملف PDF واحد
const loadPDFContent = async (filePath: string): Promise<string> => {
    try {
        console.log(`Loading PDF: ${path.basename(filePath)}`);
        const loader = new PDFLoader(filePath);
        const docs = await loader.load();
        
        // دمج محتوى جميع الصفحات
        const content = docs.map(doc => doc.pageContent).join('\n');
        console.log(`Loaded ${docs.length} pages from ${path.basename(filePath)}`);
        
        return content;
    } catch (error) {
        console.error(`Error loading PDF ${filePath}:`, error);
        return "";
    }
};

// دالة تحميل البيانات الرئيسية
const loadSampleData = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        const pdfFiles = getPDFFiles();
        
        if (pdfFiles.length === 0) {
            console.log("No PDF files found in data folder");
            return;
        }
        
        let totalChunks = 0;
        
        for (const filePath of pdfFiles) {
            const fileName = path.basename(filePath);
            console.log(`\nProcessing: ${fileName}`);
            
            const content = await loadPDFContent(filePath);
            
            if (!content.trim()) {
                console.log(`Skipping empty file: ${fileName}`);
                continue;
            }
            
            // تقسيم المحتوى إلى chunks
            const chunks = await splitter.splitText(content);
            console.log(`Split into ${chunks.length} chunks`);
            
            // معالجة كل chunk
            for (const [index, chunk] of chunks.entries()) {
                try {
                    // تنظيف النص
                    const cleanChunk = chunk
                        .replace(/\s+/g, ' ') // تنظيف المسافات الزائدة
                        .replace(/[^\x20-\x7E\u00A0-\u024F\u0600-\u06FF]/g, '') // إزالة الرموز الغريبة
                        .trim();
                    
                    if (cleanChunk.length < 50) { // تجاهل الـ chunks الصغيرة جداً
                        continue;
                    }
                    
                    // إنشاء embedding باستخدام Gemini
                    const { embedding } = await embed({
                        model: google.textEmbeddingModel('text-embedding-004'),
                        value: cleanChunk,
                    });
                    
                    // إدراج في قاعدة البيانات
                    const res = await collection.insertOne({
                        $vector: embedding,
                        text: cleanChunk,
                        source: fileName,
                        chunk_index: index,
                        timestamp: new Date().toISOString()
                    });
                    
                    totalChunks++;
                    
                    if (totalChunks % 10 === 0) {
                        console.log(`Processed ${totalChunks} chunks so far...`);
                    }
                    
                } catch (error) {
                    console.error(`Error processing chunk ${index} from ${fileName}:`, error);
                }
            }
            
            console.log(`Completed processing: ${fileName}`);
        }
        
        console.log(`\n✅ Successfully loaded ${totalChunks} total chunks from ${pdfFiles.length} PDF files`);
        
    } catch (error) {
        console.error("Error in loadSampleData:", error);
    }
};

// دالة لحذف المجموعة (مفيدة للتطوير)
const deleteCollection = async () => {
    try {
        const res = await db.dropCollection(ASTRA_DB_COLLECTION);
        console.log("Collection deleted:", res);
    } catch (error) {
        console.error("Error deleting collection:", error);
    }
};

// دالة لعرض إحصائيات المجموعة
const getCollectionStats = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        const stats = await collection.estimatedDocumentCount();
        console.log(`Collection contains approximately ${stats} documents`);
    } catch (error) {
        console.error("Error getting collection stats:", error);
    }
};

// تشغيل البرنامج
const main = async () => {
    console.log("🔒 Starting Cybersecurity PDF Data Loading...");
    console.log(`📁 Looking for PDF files in: ${DATA_FOLDER}`);
    
    try {
        await createCollection();
        await loadSampleData();
        await getCollectionStats();
        console.log("🎉 Data loading completed successfully!");
    } catch (error) {
        console.error("❌ Error in main process:", error);
    }
};

// تصدير الدوال للاستخدام في أماكن أخرى
export { createCollection, loadSampleData, deleteCollection, getCollectionStats };

// تشغيل البرنامج إذا تم استدعاؤه مباشرة
if (require.main === module) {
    main();
}