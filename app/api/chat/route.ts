import { google } from '@ai-sdk/google';
import { streamText, embed, CoreMessage } from 'ai';
import { DataAPIClient } from "@datastax/astra-db-ts";

const {
    ASTRA_DB_NAMESPACE,
    ASTRA_DB_COLLECTION,
    ASTRA_DB_API_ENDPOINT,
    ASTRA_DB_APPLICATION_TOKEN,
} = process.env;

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { keyspace: ASTRA_DB_NAMESPACE as string });

// تعريف أنواع البيانات
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface RequestBody {
    messages?: ChatMessage[];
}

interface DatabaseDocument {
    text?: string;
    filename?: string;
    $similarity?: number;
    [key: string]: unknown; // للسماح بخصائص إضافية من قاعدة البيانات
}

export async function POST(req: Request) {
    try {
        const body: RequestBody = await req.json();
        const messages = body.messages || [];
        
        // التحقق من وجود الرسائل
        if (!messages || messages.length === 0) {
            return new Response(
                JSON.stringify({ error: "No messages provided" }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }
        
        const lastMessage = messages[messages.length - 1]?.content;
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
                const relevantDocs = documents.filter((doc: DatabaseDocument) => 
                    (doc.$similarity || 0) > 0.7
                );

                if (relevantDocs.length > 0) {
                    
                    docContext = relevantDocs
                        .map((doc: DatabaseDocument) => doc.text || '')
                        .filter(text => text.trim() !== '')
                        .join('\\n\\n---\\n\\n');
                    
                    // Collect sources
                    relevantSources = [...new Set(
                        relevantDocs
                            .map((doc: DatabaseDocument) => doc.filename)
                            .filter((source): source is string => 
                                source !== undefined && source !== null && source.trim() !== ''
                            )
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

        const template: CoreMessage = {
            role: "system",
content: `
أنا مساعدك الذكي في متجر الساعات، خبير في كل ما يتعلق بالساعات الفاخرة.

مهمتك: تقديم إجابات دقيقة ومفيدة عن منتجات وخدمات متجر الساعات، بالاعتماد على السياق التالي:

${docContext ? `معلومات عن متجر الساعات ومنتجاته:\n${docContext}\n` : ''}

قواعد مهمة:
- استخدم المعلومات المقدمة من السياق فقط للإجابة على السؤال.
- اجعل الإجابة مختصرة، مباشرة، ومفيدة، دون إطالة أو تفاصيل غير ضرورية.
- اكتب باللغة العربية الفصحى.
- إذا كان السؤال مكتوبًا بلهجة عامية، افهم القصد وأجب بلغة فصحى.
- إذا لم تجد معلومات كافية في السياق المقدم، قل: "لا تتوفر لدي معلومات كافية حول هذا الموضوع. يمكنك التواصل مباشرة مع فريق متجر الساعات لمزيد من التفاصيل."
- استخدم أسلوب ودود ولبق في الرد، واظهر الحماس لمساعدة العميل في اختيار الساعة المناسبة.
- ركز على كيفية مساعدة العميل في العثور على الساعة التي تناسب ذوقه واحتياجاته.

سؤال العميل:
${lastMessage}
`
        };
        // Filter user messages (remove empty or inappropriate messages)
        const filteredMessages = messages.filter((msg: ChatMessage) => 
            msg.content && 
            msg.content.trim() !== "" && 
            msg.content.length < 2000 // Maximum message length
        );

        // Convert to CoreMessage format
        const coreMessages: CoreMessage[] = filteredMessages.map((msg): CoreMessage => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content
        }));

        // Combine all messages with proper typing
        const allMessages: CoreMessage[] = [template, ...coreMessages];

        // Use Gemini for text generation
        const response = streamText({
            model: google('gemini-1.5-flash'),
            messages: allMessages,
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
