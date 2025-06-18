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
            const cursor = collection.find(null, {
                sort: {
                    $vector: embedding,
                },
                limit: 5, // Reduce number for better performance
                includeSimilarity: true // Add similarity score
            });

            const documents = await cursor.toArray();
            console.log(`Found ${documents.length} relevant documents`);

            if (documents && documents.length > 0) {
                // Filter results by similarity score
                const relevantDocs = documents.filter(doc => 
                    doc.$similarity && doc.$similarity > 0.7 // Similarity threshold
                );

                if (relevantDocs.length > 0) {
                    docContext = relevantDocs
                        .map(doc => doc.text)
                        .join('\n\n---\n\n');
                    
                    // Collect sources
                    relevantSources = [...new Set(
                        relevantDocs
                            .map(doc => doc.source)
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
You are an expert cybersecurity assistant (Cybersecurity Expert Assistant). 
Your task is to provide clear, accurate, and detailed answers about cybersecurity questions using the available context below.

Important rules:
1. Use information from the provided context as top priority
2. If the context doesn't contain enough information, use your general cybersecurity knowledge
3. Provide practical and actionable answers
4. Mention specific tools and techniques when possible
5. Highlight risks and security precautions
6. If the question is about malicious tools or attacks, focus on defensive and preventive aspects
7. Use Arabic in responses while mentioning technical terms in English

Areas you can assist with:
- Types of cyber attacks and protection methods
- Cybersecurity tools and ethical testing
- Security best practices
- Risk management and security vulnerabilities
- Secure networks and encryption
- Incident response

${docContext ? `
--------------
Context from specialized documents:
${docContext}
--------------
` : ''}

${relevantSources.length > 0 ? `
Relevant sources: ${relevantSources.join(', ')}
` : ''}

Question: ${lastMessage}

Please provide a comprehensive and useful answer. If you're unsure about information, say "I apologize, I don't have enough information to answer this question accurately."
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
            temperature: 0.7, // Balance between creativity and accuracy
            maxTokens: 2000, // Maximum response length
            topP: 0.9,
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
            message: "Cybersecurity Chatbot API is running", 
            status: "active",
            endpoints: {
                POST: "Send messages to chat with the cybersecurity expert"
            }
        }), 
        { 
            status: 200, 
            headers: { 'Content-Type': 'application/json' } 
        }
    );
}