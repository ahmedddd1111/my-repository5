import { DataAPIClient } from "@datastax/astra-db-ts";
import { embed } from "ai";
import { google } from "@ai-sdk/google";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { readFileSync } from "fs";
import { join } from "path";
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

const loadWamedData = async () => {
    try {
        // قراءة ملف البيانات الجديد
        const dataPath = join(process.cwd(), 'data', 'wamedadv_full_content.txt');
        const content = readFileSync(dataPath, 'utf-8');
        
        console.log("Loading Wamed company data from wamedadv_full_content.txt...");
        
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        
        // تقسيم المحتوى إلى أجزاء
        const chunks = await splitter.splitText(content);
        
        console.log(`Processing ${chunks.length} text chunks...`);
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // استخدام Gemini للـ embedding
            const { embedding } = await embed({
                model: google.textEmbeddingModel('text-embedding-004'),
                value: chunk,
            });

            const vector = embedding;
            const res = await collection.insertOne({
                $vector: vector,
                text: chunk
            });
            
            console.log(`Processed chunk ${i + 1}/${chunks.length}:`, res.insertedId);
        }
        
        console.log("✅ Wamed data loaded successfully from wamedadv_full_content.txt!");
        
    } catch (error) {
        console.error("❌ Error loading Wamed data:", error);
    }
};

// حذف البيانات القديمة (اختياري)
const clearCollection = async () => {
    try {
        const collection = await db.collection(ASTRA_DB_COLLECTION);
        const result = await collection.deleteMany({});
        console.log(`Cleared ${result.deletedCount} documents from collection`);
    } catch (error) {
        console.log("Error clearing collection:", error);
    }
};

// تشغيل السكريبت
const main = async () => {
    console.log("🚀 Starting Wamed data loading process...");
    
    // إنشاء المجموعة
    await createCollection();
    
    // حذف البيانات القديمة (اختياري - قم بإزالة التعليق إذا أردت)
    // await clearCollection();
    
    // تحميل بيانات Wamed
    await loadWamedData();
    
    console.log("🎉 Data loading process completed!");
};

main().catch(console.error);