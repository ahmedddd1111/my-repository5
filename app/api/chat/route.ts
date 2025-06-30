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

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages?.length - 1]?.content;
        let docContext = "";
        let relevantSources: string[] = [];

        // Check if message exists
        if (!lastMessage || lastMessage.trim() === "") {
            return new Response(
                JSON.stringify({ error: "No message provided" }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        console.log("User question:", lastMessage);

        // Create embedding using Gemini
        const { embedding } = await embed({
            model: google.textEmbeddingModel('text-embedding-004'),
            value: lastMessage,
        });

        try {
            const collection = await db.collection(ASTRA_DB_COLLECTION);
            
            // تحسين البحث - البحث في جميع أنواع المحتوى
            const cursor = collection.find(null, {
                sort: {
                    $vector: embedding,
                },
                limit: 5, 
                includeSimilarity: true
            });

            const documents = await cursor.toArray();
            console.log(`Found ${documents.length} relevant documents`);

            if (documents && documents.length > 0) {
                // تحسين عتبة التشابه بناءً على نوع المحتوى
                const relevantDocs = documents.filter(doc => (doc.$similarity || 0) > 0.7);

                if (relevantDocs.length > 0) {
                    
                    docContext = relevantDocs
                        .map(doc => doc.text)
                        .join('\\n\\n---\\n\\n');
                    
                    // Collect sources
                    relevantSources = [...new Set(
                        relevantDocs
                            .map(doc => doc.filename) // use filename as source
                            .filter(source => source)
                    )];
                    
                    console.log("Relevant sources:", relevantSources);
                } else {
                    console.log("No documents meet similarity threshold");
                }
            }

        } catch (err) {
            console.error("Error querying database:", err);
            docContext = "";
        }

        const template = {
            role: "system",
            content: `
أنت مساعد وميض الذكي، خبير في خدمات شركة وميض للدعاية والإعلان والتسويق الرقمي.

مهمتك: تقديم إجابات دقيقة ومفيدة عن خدمات شركة وميض، بالاعتماد على السياق التالي:

${docContext ? `معلومات عن شركة وميض وخدماتها:\n${docContext}\n` : ''}

قواعد مهمة:
- استخدم المعلومات المقدمة من السياق فقط للإجابة على السؤال.
- كن واضحًا ومباشرًا ومفيدًا.
- اكتب باللغة العربية الفصحى.
- إذا كان السؤال مكتوبًا بلهجة عامية، افهم القصد وأجب بلغة فصحى.
- إذا لم تجد إجابة في المعلومات المتوفرة، قل: "لا تتوفر لدي معلومات كافية حول هذا الموضوع. يمكنك التواصل مباشرة مع فريق وميض لمزيد من التفاصيل عبر الهاتف: 966565392584+ أو البريد الإلكتروني: info@wamedadv.com".

سؤال العميل:
${lastMessage}
        `
        };

        // Add system messages for context
        const systemMessages = [template];
        
        // Filter user messages (remove empty or inappropriate messages)
        const filteredMessages = messages.filter((msg: any) => 
            msg.content && 
            msg.content.trim() !== "" && 
            msg.content.length < 2000 // Maximum message length
        );

        // Use Gemini for text generation
        const response = streamText({
            model: google('gemini-1.5-flash'),
            messages: [...systemMessages, ...filteredMessages],
            temperature: 0.6, // تقليل الإبداع للحصول على إجابات أكثر دقة
            maxTokens: 1500, // تقليل طول الرد للحصول على إجابات أكثر تركيزاً
            topP: 0.8,
        });

        return response.toDataStreamResponse();

    } catch (err) {
        console.error('Error in POST handler:', err);
        
        // Return detailed error response
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        
        return new Response(
            JSON.stringify({ 
                error: "An error occurred while processing your request. Please try again.", 
                details: errorMessage 
            }), 
            { 
                status: 500, 
                headers: { 'Content-Type': 'application/json' } 
            }
        );
    }
}

// Add GET support for endpoint testing
export async function GET() {
    return new Response(
        JSON.stringify({ 
            message: "Wamed Chatbot API is running", 
            status: "active",
            endpoints: {
                POST: "Send messages to chat with the Wamed assistant"
            }
        }), 
        { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        }
    );
}