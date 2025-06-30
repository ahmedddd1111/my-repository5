import { google } from '@ai-sdk/google';
import { streamText, embed } from 'ai';
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE as string });

// Cache بسيط للاستعلامات المتكررة
const queryCache = new Map();

// دالة لإضافة تأخير
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages?.length - 1]?.content;
        let docContext = "";

        // إضافة تأخير اصطناعي (2 ثانية)
        await delay(2000);

        // التحقق من Cache أولاً
        const cacheKey = lastMessage.toLowerCase().trim();
        if (queryCache.has(cacheKey)) {
            docContext = queryCache.get(cacheKey);
        } else {
            // إنشاء embedding باستخدام Gemini
            const { embedding } = await embed({
                model: google.textEmbeddingModel('text-embedding-004'),
                value: lastMessage,
            });

            try {
                const collection = await db.collection(ASTRA_DB_COLLECTION);
                const cursor = collection.find(null, {
                    sort: {
                        $vector: embedding,
                    },
                    limit: 3 // تقليل أكثر لتحسين السرعة
                });

                const documents = await cursor.toArray();
                const docsMap = documents?.map(doc => doc.text);
                docContext = docsMap?.join(' ') || "";

                // حفظ في Cache
                queryCache.set(cacheKey, docContext);
                
                // تنظيف Cache كل 100 استعلام
                if (queryCache.size > 100) {
                    const firstKey = queryCache.keys().next().value;
                    queryCache.delete(firstKey);
                }

            } catch (err) {
                console.log("Error querying db...");
                docContext = "";
            }
        }

        const template = {
            role: "system",
            content: `أنت WamedBot، مساعد ذكي تابع لشركة وميض للخدمات التسويقية.

مهمتك: تقديم إجابات دقيقة وواضحة للعملاء حول خدمات ومجالات عمل الشركة، بالاعتماد أولًا على البيانات المتوفرة لديك:

${docContext ? `معلومات الشركة والخدمات:\n${docContext}\n` : ''}

قواعد مهمة:
- استخدم المعلومات المقدمة أولًا، وإذا لم تكن كافية، استخدم معرفتك العامة لتقديم إجابة مفيدة قدر الإمكان.
- أجب باللغة العربية الفصحى أو الإنجليزية حسب لغة العميل، مع محاولة فهم وتصحيح الأخطاء الإملائية إن وجدت.
- كن ودودًا، محترمًا، وركّز دائمًا على إفادة العميل.
- إذا لم تجد إجابة مناسبة في المعلومات المتوفرة أو معرفتك، اعتذر بلطف واقترح على العميل التواصل مع خدمة العملاء على الرقم +966565392584، واذكر له أن خدمة العملاء متاحة 24 ساعة في خدمته.

سؤال العميل:
${lastMessage}
`
        };

        // استخدام Gemini للـ text generation مع تحسينات
        const response = streamText({
            model: google('gemini-1.5-flash'),
            messages: [template, ...messages],
            maxTokens: 300, // تقليل أكثر للسرعة
            temperature: 0.5, // تقليل الإبداع أكثر
        });

        return response.toDataStreamResponse();

    } catch (err) {
        console.error('Error in POST handler:', err);
        return new Response('Internal Server Error', { status: 500 });
    }
}